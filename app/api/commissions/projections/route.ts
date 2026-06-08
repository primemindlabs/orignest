import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { projectPipeline, type CompPlan, type PipelineLead } from '@/lib/commissions/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OPEN_STAGES = [
  'new_inquiry',
  'pre_qual',
  'application',
  'processing',
  'underwriting',
  'conditional_approval',
  'clear_to_close',
];

/**
 * GET /api/commissions/projections — probability-weighted commission forecast
 * from the open pipeline, using each loan's applicable comp plan.
 */
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();

  const [{ data: plans }, { data: leads }] = await Promise.all([
    sb.from('comp_plans').select('*').eq('org_id', orgId).eq('is_active', true),
    sb
      .from('leads')
      .select('id, loan_amount, stage, assigned_to')
      .eq('org_id', orgId)
      .in('stage', OPEN_STAGES),
  ]);

  const pipelineLeads: PipelineLead[] = (leads ?? []).map((l) => ({
    id: l.id as string,
    loan_amount: l.loan_amount as number | null,
    stage: l.stage as string,
    lo_id: (l.assigned_to as string | null) ?? null,
  }));

  const projection = projectPipeline(pipelineLeads, (plans ?? []) as CompPlan[]);
  return NextResponse.json({ projection, planCount: plans?.length ?? 0 });
}
