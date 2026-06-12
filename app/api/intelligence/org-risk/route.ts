/**
 * Phase 129 — GET /api/intelligence/org-risk
 * Org-wide view of loans flagged with high fallout risk: low close probability
 * or any active fallout flags. Sorted by close probability ascending (worst first).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RISK_PROB_THRESHOLD = 0.30;

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb
    .from('loan_intelligence_scores')
    .select('loan_id, lo_id, file_health_score, close_probability, uw_readiness_score, predicted_close_date, fallout_flags, lead:leads!inner(first_name, last_name, stage)')
    .eq('org_id', orgId)
    .order('close_probability', { ascending: true })
    .limit(500);

  const atRisk = (data ?? []).filter((s) => {
    const flags = Array.isArray(s.fallout_flags) ? s.fallout_flags : [];
    return (s.close_probability ?? 1) < RISK_PROB_THRESHOLD || flags.length > 0;
  });

  return NextResponse.json({ loans: atRisk });
}
