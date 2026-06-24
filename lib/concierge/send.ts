/**
 * Phase 144 — transmit a concierge SMS reply. SERVER-ONLY.
 *
 * Mirrors lib/goldmine/sendOutreach's send path (Twilio + LO sender identity + NMLS
 * disclaimer). The TCPA gate and the compliance guard run in the engine BEFORE this
 * is called — this only formats and transmits. Inert (returns ok:false) when Twilio
 * isn't configured, so nothing fake is "sent".
 */
import 'server-only';
import twilio from 'twilio';
import type { SupabaseClient } from '@supabase/supabase-js';
import { nmlsDisclaimer } from '@/lib/coMarketing/copyPrompts';
import { buildSenderIdentity } from '@/lib/relay/sender';

type Admin = SupabaseClient<any, any, any>;

export async function sendConciergeSms(
  sb: Admin,
  args: { orgId: string; leadId: string; loId: string | null; body: string },
): Promise<{ ok: boolean; reason?: string }> {
  if (!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)) {
    return { ok: false, reason: 'Twilio not configured' };
  }

  const [{ data: lo }, { data: org }, { data: lead }] = await Promise.all([
    args.loId ? sb.from('profiles').select('first_name, last_name, nmls_id, email, phone').eq('id', args.loId).maybeSingle() : Promise.resolve({ data: null }),
    sb.from('organizations').select('name').eq('id', args.orgId).maybeSingle(),
    sb.from('leads').select('phone').eq('id', args.leadId).eq('org_id', args.orgId).maybeSingle(),
  ]);
  const to = (lead as { phone: string | null } | null)?.phone;
  if (!to) return { ok: false, reason: 'No phone on file' };

  const loRow = (lo ?? {}) as { first_name: string | null; last_name: string | null; nmls_id: string | null; email: string | null; phone: string | null };
  const orgName = ((org ?? {}) as { name: string | null }).name ?? null;
  const loName = `${loRow.first_name ?? ''} ${loRow.last_name ?? ''}`.trim() || 'Your Loan Officer';
  const identity = buildSenderIdentity(loRow, { name: orgName, reply_to_email: null, twilio_number: process.env.DEFAULT_TWILIO_NUMBER || process.env.TWILIO_PHONE_NUMBER || null });
  if (!identity.sms_from) return { ok: false, reason: 'No sending number configured' };

  // First message of a conversation carries the NMLS identity line; keep follow-ups clean.
  const body = `${args.body}\n\n${nmlsDisclaimer(loName, loRow.nmls_id, orgName)}`.trim();

  try {
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    await client.messages.create({ body, from: identity.sms_from, to });
  } catch (e) {
    console.error('[concierge] sms send failed', e);
    return { ok: false, reason: 'Send failed' };
  }
  return { ok: true };
}
