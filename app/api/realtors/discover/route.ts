/**
 * Phase 48.3/48.7 — realtor discovery.
 *   GET  → market prospects (has_relationship=false) ranked by LO↔realtor match
 *   POST → add a prospect to the network (creates a realtors row, links profile)
 * The LO profile is derived from the org's own loan data (avg loan, top loan types).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeMatchScore, type LOProfile } from '@/lib/realtors/matchScore';
import { computePartnershipScore } from '@/lib/realtors/partnershipScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function loProfile(sb: ReturnType<typeof createAdminClient>, orgId: string): Promise<LOProfile> {
  const { data: leads } = await sb.from('leads').select('loan_amount, loan_type').eq('org_id', orgId).limit(1000);
  const amounts = (leads ?? []).map((l) => Number(l.loan_amount)).filter((n) => n > 0);
  const avg = amounts.length ? amounts.reduce((a, b) => a + b, 0) / amounts.length : 350000;
  const typeCount = new Map<string, number>();
  for (const l of leads ?? []) if (l.loan_type) typeCount.set(l.loan_type, (typeCount.get(l.loan_type) ?? 0) + 1);
  const strong = [...typeCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);
  return { primary_zip_codes: [], avg_loan_amount: avg, strong_loan_types: strong };
}

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const [{ data: profiles }, lo] = await Promise.all([
    sb.from('realtor_market_profiles').select('*').eq('org_id', orgId).eq('has_relationship', false).limit(500),
    loProfile(sb, orgId),
  ]);

  const ranked = (profiles ?? [])
    .map((p) => ({ profile: p, match: computeMatchScore(lo, p) }))
    .sort((a, b) => b.match.score - a.match.score);

  return NextResponse.json({ prospects: ranked, lo_avg_loan: lo.avg_loan_amount });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { market_profile_id } = (await req.json().catch(() => ({}))) as { market_profile_id?: string };
  if (!market_profile_id) return NextResponse.json({ error: 'market_profile_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: p } = await sb.from('realtor_market_profiles').select('*').eq('id', market_profile_id).eq('org_id', orgId).maybeSingle();
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const inputs = { transactions_12m: p.transactions_12m ?? 0, volume_12m: 0, buyer_side_pct: p.buyer_side_pct != null ? Number(p.buyer_side_pct) * 100 : null, deals_referred_12m: 0, last_attom_sync: p.last_synced_at, last_contact_at: null, last_referral_at: null };
  const { score, tier } = computePartnershipScore(inputs);

  const { data: realtor, error } = await sb.from('realtors').insert({
    org_id: orgId, first_name: p.first_name, last_name: p.last_name, email: p.email, phone: p.phone,
    brokerage_name: p.brokerage, primary_zip_codes: p.primary_zip_codes, primary_city: null,
    mls_agent_id: p.mls_agent_id, attom_agent_id: p.attom_agent_id,
    transactions_12m: p.transactions_12m ?? 0, buyer_side_pct: p.buyer_side_pct != null ? Number(p.buyer_side_pct) * 100 : null,
    partnership_score: score, partnership_tier: tier,
  }).select('id').single();
  if (error) { console.error('[discover] add', error); return NextResponse.json({ error: 'save_failed' }, { status: 500 }); }

  await sb.from('realtor_market_profiles').update({ has_relationship: true, realtor_id: realtor.id }).eq('id', market_profile_id).eq('org_id', orgId);
  return NextResponse.json({ realtor_id: realtor.id });
}
