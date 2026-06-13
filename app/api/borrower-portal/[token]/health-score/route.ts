// Phase 123 — Mortgage Health Score (token-gated). Cached 24h; recomputed + inserted otherwise.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePortalToken } from '@/lib/portal/token';
import { computeHealthScore } from '@/lib/portal/healthScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function compute(sb: ReturnType<typeof createAdminClient>, leadId: string, orgId: string) {
  const { data: lead } = await sb
    .from('leads')
    .select('credit_score, ltv, original_rate, estimated_value, loan_amount')
    .eq('id', leadId).eq('org_id', orgId).maybeSingle();

  const { data: mkt } = await sb
    .from('market_rate_snapshots')
    .select('rate, product')
    .ilike('product', '%30%')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const marketRate = mkt?.rate != null ? Number(mkt.rate) : null;

  const ltv = lead?.ltv != null ? Number(lead.ltv) : (lead?.loan_amount && lead?.estimated_value ? Number(lead.loan_amount) / Number(lead.estimated_value) : null);
  const equityEstimate = lead?.estimated_value != null && lead?.loan_amount != null ? Number(lead.estimated_value) - Number(lead.loan_amount) : null;

  const result = computeHealthScore({
    creditScore: lead?.credit_score != null ? Number(lead.credit_score) : null,
    ltv,
    currentRate: lead?.original_rate != null ? Number(lead.original_rate) : null,
    marketRate,
    hasPmi: ltv != null && ltv > 0.8,
    monthlyLoanBalance: lead?.loan_amount != null ? Number(lead.loan_amount) : null,
  });

  const { data: inserted } = await sb.from('mortgage_health_scores').insert({
    lead_id: leadId, org_id: orgId, score: result.score, credit_score: result.credit_score,
    equity_estimate: equityEstimate, current_rate: result.current_rate, market_rate: result.market_rate,
    rate_comparison_delta: result.rate_comparison_delta, action_items: result.action_items,
  }).select('*').single();
  return inserted;
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const id = await resolvePortalToken(sb, params.token);
  if (!id) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });

  const { data: latest } = await sb
    .from('mortgage_health_scores')
    .select('*')
    .eq('lead_id', id.leadId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest) {
    const ageHours = (Date.now() - new Date(latest.computed_at as string).getTime()) / 3_600_000;
    if (ageHours < 24) return NextResponse.json({ score: latest });
  }
  const fresh = await compute(sb, id.leadId, id.orgId);
  return NextResponse.json({ score: fresh ?? latest });
}
