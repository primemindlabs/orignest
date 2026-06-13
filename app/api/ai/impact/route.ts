// "Ashley's Impact" — aggregates this month's AI + automation activity into a single
// ROI story for the org (the renewal argument: what Ashley did for your team).
// Surfaces data already collected; no new tables.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Time-saved heuristics (minutes per item) — conservative, defensible.
const MIN_PER = { automatedUpdate: 4, aiAssist: 5, proposal: 25, alert: 3, loanAdvanced: 6 };

const count = async (q: any): Promise<number> => {
  const { count: c } = await q;
  return c ?? 0;
};

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const head = { count: 'exact' as const, head: true };

  const [loaQueries, ashleyAnswers, milestoneSent, outreachSent, alerts, proposals, txns] = await Promise.all([
    count(sb.from('loa_queries').select('id', head).eq('org_id', orgId).gte('created_at', monthStart)),
    count(sb.from('ashley_conversations').select('id', head).eq('org_id', orgId).eq('role', 'assistant').gte('created_at', monthStart)),
    count(sb.from('milestone_automation_log').select('id', head).eq('org_id', orgId).not('sent_at', 'is', null).gte('sent_at', monthStart)),
    count(sb.from('outreach_queue').select('id', head).eq('org_id', orgId).eq('status', 'sent').gte('created_at', monthStart)),
    count(sb.from('notifications').select('id', head).eq('org_id', orgId).gte('created_at', monthStart)),
    count(sb.from('loan_proposals').select('id', head).eq('org_id', orgId).gte('created_at', monthStart)),
    sb.from('stage_transitions').select('lead_id').eq('org_id', orgId).gte('transitioned_at', monthStart),
  ]);

  const advancedLeadIds = Array.from(new Set(((txns.data ?? []) as { lead_id: string }[]).map((t) => t.lead_id).filter(Boolean)));

  // Pipeline touched = total loan amount of loans that moved forward this month.
  let pipelineTouched = 0;
  if (advancedLeadIds.length) {
    const { data: leads } = await sb.from('leads').select('loan_amount').in('id', advancedLeadIds.slice(0, 1000));
    pipelineTouched = (leads ?? []).reduce((s, l) => s + Number(l.loan_amount ?? 0), 0);
  }

  const aiAssists = loaQueries + ashleyAnswers;
  const automatedUpdates = milestoneSent + outreachSent;
  const loansAdvanced = advancedLeadIds.length;

  const minutes =
    automatedUpdates * MIN_PER.automatedUpdate +
    aiAssists * MIN_PER.aiAssist +
    proposals * MIN_PER.proposal +
    alerts * MIN_PER.alert +
    loansAdvanced * MIN_PER.loanAdvanced;
  const hoursSaved = Math.round((minutes / 60) * 10) / 10;

  return NextResponse.json({
    month: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    hoursSaved,
    pipelineTouched,
    breakdown: { aiAssists, automatedUpdates, alertsSurfaced: alerts, proposals, loansAdvanced },
  });
}
