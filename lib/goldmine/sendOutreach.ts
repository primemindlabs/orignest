/** Phase 131 — send a Goldmine outreach (SMS/email) with TCPA + NMLS guards. */
import 'server-only';
import twilio from 'twilio';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canSendSMS } from '@/lib/communications/canSendSMS';
import { sendCompliantEmail } from '@/lib/resend';
import { nmlsDisclaimer } from '@/lib/coMarketing/copyPrompts';
import { buildSenderIdentity } from '@/lib/relay/sender';

function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

export interface OutreachOpp {
  contact_id: string;
  draft_sms: string | null;
  draft_email_subject: string | null;
  draft_email_body: string | null;
}

export async function sendGoldmineOutreach(
  sb: SupabaseClient,
  opp: OutreachOpp,
  channel: 'sms' | 'email',
  loId: string,
  orgId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const [{ data: lo }, { data: org }, { data: lead }] = await Promise.all([
    sb.from('profiles').select('first_name, last_name, nmls_id, email, phone').eq('id', loId).maybeSingle(),
    sb.from('organizations').select('name').eq('id', orgId).maybeSingle(),
    sb.from('leads').select('phone, email').eq('id', opp.contact_id).maybeSingle(),
  ]);
  const loRow = (lo ?? {}) as { first_name: string | null; last_name: string | null; nmls_id: string | null; email: string | null; phone: string | null };
  const orgName = ((org ?? {}) as { name: string | null }).name ?? null;
  const loName = `${loRow.first_name ?? ''} ${loRow.last_name ?? ''}`.trim() || 'Your Loan Officer';
  const disclaimer = nmlsDisclaimer(loName, loRow.nmls_id, orgName);
  const identity = buildSenderIdentity(loRow, { name: orgName, reply_to_email: null, twilio_number: process.env.DEFAULT_TWILIO_NUMBER || process.env.TWILIO_PHONE_NUMBER || null });

  if (channel === 'sms') {
    const gate = await canSendSMS(sb, { orgId, leadId: opp.contact_id, category: 'marketing' });
    if (!gate.allowed) return { ok: false, reason: gate.reason ?? 'TCPA not permitted' };
    const to = (lead as { phone: string | null } | null)?.phone;
    if (!to) return { ok: false, reason: 'No phone on file' };
    const body = `${opp.draft_sms ?? ''}\n\n${disclaimer}`.trim();
    if (twilioConfigured() && identity.sms_from) {
      try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await client.messages.create({ body, from: identity.sms_from, to });
      } catch (e) {
        console.error('[goldmine] sms send failed', e);
        return { ok: false, reason: 'Send failed' };
      }
    }
    return { ok: true };
  }

  // email
  const to = (lead as { email: string | null } | null)?.email;
  if (!to) return { ok: false, reason: 'No email on file' };
  const text = `${opp.draft_email_body ?? ''}\n\n${disclaimer}`.trim();
  try {
    await sendCompliantEmail({
      to,
      subject: opp.draft_email_subject ?? 'A quick note',
      text,
      orgId,
      recipientEmail: to,
      leadId: opp.contact_id,
    });
  } catch (e) {
    console.error('[goldmine] email send failed', e);
    return { ok: false, reason: 'Send failed' };
  }
  return { ok: true };
}
