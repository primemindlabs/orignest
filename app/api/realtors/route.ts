/**
 * Phase 40 — realtors: GET list (by tier/score), POST add a realtor.
 * Partnership score + tier are computed on insert from the production inputs.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computePartnershipScore } from '@/lib/realtors/partnershipScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const tier = new URL(req.url).searchParams.get('tier');
  const sb = createAdminClient();
  let q = sb.from('realtors').select('*').eq('org_id', orgId).eq('is_archived', false).order('partnership_score', { ascending: false });
  if (tier) q = q.eq('partnership_tier', tier);
  const { data } = await q.limit(500);
  return NextResponse.json({ realtors: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.first_name || !b.last_name) return NextResponse.json({ error: 'First and last name are required' }, { status: 400 });

  const inputs = {
    transactions_12m: Number(b.transactions_12m) || 0,
    volume_12m: Number(b.volume_12m) || 0,
    buyer_side_pct: b.buyer_side_pct != null ? Number(b.buyer_side_pct) : null,
    deals_referred_12m: Number(b.deals_referred_12m) || 0,
    last_attom_sync: null,
    last_contact_at: null,
    last_referral_at: null,
  };
  const { score, tier } = computePartnershipScore(inputs);

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('realtors')
    .insert({
      org_id: orgId,
      first_name: String(b.first_name), last_name: String(b.last_name),
      email: b.email ? String(b.email) : null, phone: b.phone ? String(b.phone) : null,
      brokerage_name: b.brokerage_name ? String(b.brokerage_name) : null,
      primary_city: b.primary_city ? String(b.primary_city) : null,
      transactions_12m: inputs.transactions_12m, volume_12m: inputs.volume_12m,
      buyer_side_pct: inputs.buyer_side_pct, seller_side_pct: inputs.buyer_side_pct != null ? 100 - inputs.buyer_side_pct : null,
      deals_referred_12m: inputs.deals_referred_12m,
      partnership_score: score, partnership_tier: tier,
      relationship_notes: b.relationship_notes ? String(b.relationship_notes) : null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[realtors] insert failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ realtor: data });
}
