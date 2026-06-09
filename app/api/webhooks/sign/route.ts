/**
 * Phase 60.4 — PrimeMind Sign webhook. HMAC-SHA256 timing-safe verified. INERT
 * without PRIMEMIND_SIGN_WEBHOOK_SECRET. Records every event to the INSERT-only
 * sign_events log, advances sign_envelopes, and on completion stamps the TRID
 * fields (Intent-to-Proceed on initial disclosures; CD signed on closing).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHmac, timingSafeEqual } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.PRIMEMIND_SIGN_WEBHOOK_SECRET;
  const raw = await req.text();
  if (!secret) return NextResponse.json({ received: false, gated: 'PRIMEMIND_SIGN_WEBHOOK_SECRET not set' }, { status: 200 });

  const sig = req.headers.get('x-primemind-sign-signature') ?? '';
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let event: { envelopeId?: string; type?: string; recipientRole?: string; occurredAt?: string; metadata?: Record<string, unknown> };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad payload' }, { status: 400 }); }
  if (!event.envelopeId || !event.type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const sb = createAdminClient();
  const { data: env } = await sb.from('sign_envelopes').select('id, org_id, loan_id, package_type').eq('envelope_id', event.envelopeId).maybeSingle();
  const at = event.occurredAt ?? new Date().toISOString();
  await sb.from('sign_events').insert({ org_id: env?.org_id ?? null, envelope_id: event.envelopeId, event_type: event.type, recipient_role: event.recipientRole ?? null, occurred_at: at, metadata: event.metadata ?? null });
  if (!env) return NextResponse.json({ received: true, ignored: 'no matching envelope' });

  if (event.type === 'envelope.completed') {
    await sb.from('sign_envelopes').update({ status: 'completed', completed_at: at }).eq('id', env.id);
    if (env.loan_id && env.package_type === 'initial_disclosures') await sb.from('leads').update({ intent_to_proceed_at: at }).eq('id', env.loan_id);
    if (env.loan_id && env.package_type === 'closing_disclosure') await sb.from('leads').update({ cd_signed_at: at }).eq('id', env.loan_id);
  } else if (event.type === 'envelope.declined') {
    await sb.from('sign_envelopes').update({ status: 'declined' }).eq('id', env.id);
  } else if (event.type === 'envelope.expired') {
    await sb.from('sign_envelopes').update({ status: 'expired' }).eq('id', env.id);
  } else if (event.type === 'recipient.completed') {
    await sb.from('sign_envelopes').update({ status: 'partially_signed' }).eq('id', env.id);
  }
  return NextResponse.json({ received: true });
}
