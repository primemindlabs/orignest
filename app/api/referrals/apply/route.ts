/**
 * Phase 61.1 — PUBLIC referral application submit (no auth; service-role).
 * Looks up the referral code → creates a lead in the LO's pipeline (source=referral)
 * + a buyer_referral record + an INSERT-only referral_event. No-enumeration: an
 * unknown code still returns success (and creates an unassigned org lead if resolvable).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { ref?: string; name?: string; email?: string; phone?: string; purpose?: string; timeline?: string; sms_consent?: boolean };
  if (!b.name || (!b.email && !b.phone)) return NextResponse.json({ error: 'Name and a phone or email are required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: code } = b.ref ? await sb.from('referral_codes').select('org_id, lo_id, source_loan_id').eq('code', b.ref).eq('is_active', true).maybeSingle() : { data: null };
  if (!code) return NextResponse.json({ ok: true }); // no-enumeration

  const [first, ...rest] = b.name.trim().split(' ');
  const { data: lead } = await sb.from('leads').insert({
    org_id: code.org_id, assigned_to: code.lo_id ?? null,
    first_name: first, last_name: rest.join(' ') || '', email: b.email ?? null, phone: b.phone ?? null,
    loan_purpose: b.purpose ?? null, source: 'referral', stage: 'new_inquiry', sms_consent: !!b.sms_consent,
  }).select('id').single();

  await sb.from('buyer_referrals').insert({ org_id: code.org_id, referrer_lead_id: code.source_loan_id ?? null, referral_code: b.ref, referred_name: b.name, referred_email: b.email ?? null, referred_phone: b.phone ?? null, status: 'new', converted_lead_id: lead?.id ?? null }).then(() => undefined, () => undefined);
  await sb.from('referral_events').insert({ org_id: code.org_id, referral_code: b.ref, source_loan_id: code.source_loan_id ?? null, referred_lead_id: lead?.id ?? null, referred_name: b.name, referred_email: b.email ?? null, referred_phone: b.phone ?? null, event_type: 'lead_created' });
  return NextResponse.json({ ok: true });
}
