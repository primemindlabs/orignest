// Phase 116 — unified SMS compliance gate. Available for new send flows (existing
// senders keep their inline checks). Layers, in order:
//   1. sms_opt_outs (P97) — hard opt-out
//   2. leads.sms_consent — TCPA consent on file
//   3. communication_preferences (if set) — channel opt-in + per-category toggle
//   4. calling window — per-contact prefs window, else tcpaWindow by property_state
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkCallingWindow } from '@/lib/communications/tcpaWindow';

type Admin = SupabaseClient<any, any, any>;
export type SmsCategory = 'loan_updates' | 'reminders' | 'marketing';

export interface CanSendResult {
  allowed: boolean;
  reason?: string;
}

function withinPrefWindow(timezone: string, start: string, end: string, now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const local = `${hh}:${mm}`; // 24h, zero-padded → lexical compare is valid
  return local >= start.slice(0, 5) && local <= end.slice(0, 5);
}

export async function canSendSMS(
  sb: Admin,
  args: { orgId: string; leadId: string; category: SmsCategory; now?: Date }
): Promise<CanSendResult> {
  const now = args.now ?? new Date();

  const { data: lead } = await sb
    .from('leads')
    .select('phone, sms_consent, property_state')
    .eq('id', args.leadId)
    .eq('org_id', args.orgId)
    .maybeSingle();
  if (!lead) return { allowed: false, reason: 'Contact not found' };

  // 1. Hard opt-out.
  if (lead.phone) {
    const { data: optOut } = await sb
      .from('sms_opt_outs')
      .select('id')
      .eq('org_id', args.orgId)
      .eq('phone', lead.phone)
      .maybeSingle();
    if (optOut) return { allowed: false, reason: 'Contact has opted out of SMS (STOP)' };
  }

  // 2. TCPA consent.
  if (!lead.sms_consent) return { allowed: false, reason: 'No SMS consent on file (TCPA)' };
  if (!lead.phone) return { allowed: false, reason: 'No phone number on file' };

  // 3. Granular preferences (if the contact has a preferences row).
  const { data: prefs } = await sb
    .from('communication_preferences')
    .select('sms_opted_in, sms_loan_updates, sms_reminders, sms_marketing, contact_time_start, contact_time_end, contact_timezone')
    .eq('org_id', args.orgId)
    .eq('lead_id', args.leadId)
    .maybeSingle();

  if (prefs) {
    if (!prefs.sms_opted_in) return { allowed: false, reason: 'SMS turned off in preferences' };
    if (args.category === 'loan_updates' && !prefs.sms_loan_updates) return { allowed: false, reason: 'Loan-update SMS disabled' };
    if (args.category === 'reminders' && !prefs.sms_reminders) return { allowed: false, reason: 'Reminder SMS disabled' };
    if (args.category === 'marketing' && !prefs.sms_marketing) return { allowed: false, reason: 'Marketing SMS disabled' };

    if (!withinPrefWindow(prefs.contact_timezone, prefs.contact_time_start, prefs.contact_time_end, now)) {
      return { allowed: false, reason: `Outside the contact's preferred hours (${prefs.contact_time_start}–${prefs.contact_time_end} ${prefs.contact_timezone})` };
    }
    return { allowed: true };
  }

  // 4. No prefs row → fall back to the TCPA calling window by property state.
  const win = checkCallingWindow(lead.property_state, now);
  if (!win.allowed) return { allowed: false, reason: win.reason ?? 'Outside TCPA calling window' };
  return { allowed: true };
}
