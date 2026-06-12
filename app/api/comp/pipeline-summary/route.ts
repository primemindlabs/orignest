import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeComp, type CompType } from '@/lib/comp/calc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
// Fallback close-probability by stage when no Phase 83 score is stored for a lead.
const STAGE_PROB: Record<string, number> = {
  new_inquiry: 10, pre_qual: 25, application: 45, processing: 65, underwriting: 75, conditional_approval: 88, clear_to_close: 97,
};

// GET — running comp projection across the LO's active pipeline: gross, net take-home,
// and a probability-weighted "expected" view (reusing Phase 83 close scores).
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: plan } = await sb.from('lo_comp_plans').select('*').eq('lo_id', profile.id).maybeSingle();
  const compType: CompType = plan?.comp_type === 'flat_fee' ? 'flat_fee' : 'bps';

  const { data: leads } = await sb
    .from('leads')
    .select('id, loan_amount, stage')
    .eq('org_id', orgId)
    .eq('assigned_to', profile.id)
    .in('stage', ACTIVE_STAGES);

  const rows = leads ?? [];
  const ids = rows.map((l) => l.id as string);
  const probByLead: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: scores } = await sb.from('loan_probability_scores').select('lead_id, score').in('lead_id', ids);
    for (const s of scores ?? []) probByLead[s.lead_id as string] = Number(s.score);
  }

  let totalVolume = 0, gross = 0, net = 0, weightedGross = 0, weightedNet = 0;
  for (const l of rows) {
    const amount = Number(l.loan_amount) || 0;
    totalVolume += amount;
    const r = computeComp({
      loanAmount: amount,
      compType,
      bpsRate: plan?.bps_rate ?? 100,
      flatFee: plan?.flat_fee_amount ?? 0,
      branchSplitPct: plan?.branch_split_pct ?? 0,
      processorFee: plan?.processor_fee ?? 0,
    });
    const prob = (probByLead[l.id as string] ?? STAGE_PROB[l.stage as string] ?? 0) / 100;
    gross += r.grossComp;
    net += r.netComp;
    weightedGross += r.grossComp * prob;
    weightedNet += r.netComp * prob;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return NextResponse.json({
    count: rows.length,
    has_plan: !!plan,
    total_volume: r2(totalVolume),
    gross_comp: r2(gross),
    net_comp: r2(net),
    weighted_gross_comp: r2(weightedGross),
    weighted_net_comp: r2(weightedNet),
  });
}
