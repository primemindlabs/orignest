/**
 * Phase 129 — GET /api/intelligence/history?loanId=<lead id>
 * Score trend for a loan over the last 30 days (for sparklines / trend charts).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const loanId = new URL(req.url).searchParams.get('loanId');
  if (!loanId) return NextResponse.json({ error: 'loanId is required' }, { status: 400 });

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const sb = createAdminClient();
  const { data: history } = await sb
    .from('loan_intelligence_history')
    .select('file_health_score, close_probability, uw_readiness_score, predicted_close_date, fallout_flag_count, trigger_event, computed_at')
    .eq('loan_id', loanId)
    .eq('org_id', orgId)
    .gte('computed_at', since)
    .order('computed_at', { ascending: true })
    .limit(500);

  return NextResponse.json({ history: history ?? [] });
}
