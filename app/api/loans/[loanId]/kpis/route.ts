import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/loans/[loanId]/kpis — lightweight header KPI refresh (Phase 28.2 realtime).
export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, stage')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [{ data: dti }, { data: uw }, { data: lock }, { count }] = await Promise.all([
    sb.from('dti_worksheets').select('back_end_dti').eq('lead_id', params.loanId).maybeSingle(),
    sb.from('uw_files').select('risk_score').eq('lead_id', params.loanId).maybeSingle(),
    sb.from('rate_lock_expirations').select('lock_expires_at, status').eq('lead_id', params.loanId).maybeSingle(),
    sb.from('loan_conditions').select('id', { count: 'exact', head: true }).eq('lead_id', params.loanId).neq('status', 'cleared'),
  ]);

  return NextResponse.json({
    stage: lead.stage,
    dti: dti?.back_end_dti != null ? Number(dti.back_end_dti) : null,
    riskScore: uw?.risk_score != null ? Number(uw.risk_score) : null,
    lockExpiresAt: lock?.lock_expires_at ?? null,
    lockStatus: lock?.status ?? null,
    openConditions: count ?? 0,
  });
}
