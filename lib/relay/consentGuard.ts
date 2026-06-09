/**
 * Phase 31.4d — TCPA SMS consent guard (server-only).
 *
 * Call assertSmsAllowed() before EVERY outbound SMS. It hard-blocks when the
 * party has no SMS consent or has revoked it. Checks communication_consents
 * first, then falls back to leads.sms_consent for the primary borrower.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export class SmsConsentError extends Error {
  constructor(public partyIdentifier: string) {
    super(`SMS blocked: no active TCPA consent on record for ${partyIdentifier}.`);
    this.name = 'SmsConsentError';
  }
}

export async function isSmsAllowed(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  leadId: string,
  phone: string,
  partyType: 'borrower' | 'coborrower' | 'realtor' | 'title_agent' = 'borrower'
): Promise<boolean> {
  // Explicit per-party consent record wins.
  const { data: consent } = await sb
    .from('communication_consents')
    .select('sms_consent, revoked_at')
    .eq('org_id', orgId)
    .eq('lead_id', leadId)
    .eq('party_identifier', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consent) return Boolean(consent.sms_consent) && !consent.revoked_at;

  // Fallback: the lead-level borrower SMS consent captured at intake.
  if (partyType === 'borrower') {
    const { data: lead } = await sb.from('leads').select('sms_consent, unsubscribed_email').eq('id', leadId).eq('org_id', orgId).maybeSingle();
    return Boolean(lead?.sms_consent);
  }
  // No record for a non-borrower party → not allowed.
  return false;
}

export async function assertSmsAllowed(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  leadId: string,
  phone: string,
  partyType: 'borrower' | 'coborrower' | 'realtor' | 'title_agent' = 'borrower'
): Promise<void> {
  const allowed = await isSmsAllowed(sb, orgId, leadId, phone, partyType);
  if (!allowed) throw new SmsConsentError(phone);
}
