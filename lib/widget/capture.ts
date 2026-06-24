/**
 * Phase 146 — convert a website chat session into a CRM lead. SERVER-ONLY.
 *
 * Matches an existing lead by email/phone within the org, else creates one owned by
 * the widget's LO with lead_source 'web_widget'. Records an SMS consent audit row
 * when the visitor opted in, so the Concierge/speed-to-lead pipeline can text them.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient<any, any, any>;

export interface CaptureInput {
  orgId: string;
  loId: string | null;
  sessionId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  smsConsent?: boolean;
}

export async function captureLeadFromSession(sb: Admin, input: CaptureInput): Promise<string | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const phone = input.phone?.replace(/[^\d+]/g, '') || null;
  const { first, last } = splitName(input.name);
  const consent = !!input.smsConsent;

  // Match an existing lead (email first, then phone), else create.
  let leadId: string | null = null;
  if (email) {
    const { data } = await sb.from('leads').select('id, assigned_to, sms_consent').eq('org_id', input.orgId).ilike('email', email).limit(1).maybeSingle();
    leadId = (data as { id?: string } | null)?.id ?? null;
  }
  if (!leadId && phone) {
    const { data } = await sb.from('leads').select('id, assigned_to, sms_consent').eq('org_id', input.orgId).eq('phone', phone).limit(1).maybeSingle();
    leadId = (data as { id?: string } | null)?.id ?? null;
  }

  if (leadId) {
    const patch: Record<string, unknown> = {};
    if (first) patch.first_name = first;
    if (last) patch.last_name = last;
    if (email) patch.email = email;
    if (phone) patch.phone = phone;
    if (consent) patch.sms_consent = true;
    if (input.loId) patch.assigned_to = input.loId; // ensure ownership (only overwrites if provided)
    await sb.from('leads').update(patch).eq('id', leadId).eq('org_id', input.orgId).then(() => undefined, () => undefined);
  } else {
    const { data } = await sb.from('leads').insert({
      org_id: input.orgId, first_name: first || 'Website', last_name: last || 'Visitor',
      email, phone, sms_consent: consent, lead_source: 'web_widget', assigned_to: input.loId,
      stage: 'new_inquiry', data_ownership: 'company_generated',
    }).select('id').single();
    leadId = (data as { id?: string } | null)?.id ?? null;
  }

  if (leadId && consent) {
    await sb.from('consent_audit_log').insert({
      org_id: input.orgId, lead_id: leadId, lo_id: input.loId, event_type: 'sms_opt_in', channel: 'sms',
      source: 'web_widget', old_value: 'false', new_value: 'true', consent_text: 'Visitor consented to SMS via the website chat widget.',
    }).then(() => undefined, () => undefined);
  }

  await sb.from('ai_web_sessions').update({
    visitor_name: input.name ?? null, visitor_email: email, visitor_phone: phone, sms_consent: consent,
    captured: true, status: 'captured', lead_id: leadId, last_activity_at: new Date().toISOString(),
  }).eq('id', input.sessionId).then(() => undefined, () => undefined);

  return leadId;
}

function splitName(name?: string | null): { first: string; last: string } {
  const t = (name ?? '').trim();
  if (!t) return { first: '', last: '' };
  const parts = t.split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(' ') };
}
