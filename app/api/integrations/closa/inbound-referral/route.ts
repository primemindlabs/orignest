/**
 * Phase 55.1 — CLOSA → Ashley IQ inbound buyer referral (GATED).
 * Bearer token auth via SHA-256(api_key) lookup against active connections;
 * idempotent on platform_referral_id; inert until a tenant connects a real CLOSA
 * workspace (no connection → 401, never processes). SSN/DOB never accepted/stored.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();
  const hash = createHash('sha256').update(token).digest('hex');
  const { data: conn } = await sb.from('partner_platform_connections').select('id, org_id').eq('platform', 'closa').eq('is_active', true).eq('api_key_hash', hash).maybeSingle();
  if (!conn) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.borrower_first_name || !b.borrower_last_name) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

  // Idempotency.
  if (b.referral_id) {
    const { data: existing } = await sb.from('inbound_partner_referrals').select('id').eq('platform_referral_id', String(b.referral_id)).maybeSingle();
    if (existing) return NextResponse.json({ success: true, referral_id: existing.id, deduplicated: true });
  }

  const { data: referral, error } = await sb.from('inbound_partner_referrals').insert({
    org_id: conn.org_id, connection_id: conn.id, platform_referral_id: b.referral_id ? String(b.referral_id) : null,
    referring_agent_name: b.agent_name ? String(b.agent_name) : null, referring_agent_email: b.agent_email ? String(b.agent_email) : null,
    borrower_first_name: String(b.borrower_first_name), borrower_last_name: String(b.borrower_last_name),
    borrower_email: b.borrower_email ? String(b.borrower_email) : null, borrower_phone: b.borrower_phone ? String(b.borrower_phone) : null,
    source_context: { price_range: b.price_range ?? null, preferred_areas: b.preferred_areas ?? null, timeline: b.purchase_timeline ?? null, agent_note: b.agent_note ?? null },
    status: 'pending',
  }).select('id').single();
  if (error) { console.error('[closa-inbound]', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }

  await sb.from('partner_platform_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id);
  return NextResponse.json({ success: true, referral_id: referral.id });
}
