/**
 * Phase 129 — POST /api/intelligence/refresh?loanId=<lead id>
 * Manually recomputes File Intelligence for a loan and returns the fresh scores.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { recalculateLoanIntelligence } from '@/lib/intelligence/recalculateLoanIntelligence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const loanId = new URL(req.url).searchParams.get('loanId');
  if (!loanId) return NextResponse.json({ error: 'loanId is required' }, { status: 400 });

  const sb = createAdminClient();
  // Confirm the loan belongs to this org before recomputing.
  const { data: lead } = await sb.from('leads').select('id').eq('id', loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  await recalculateLoanIntelligence(sb, loanId, 'manual_refresh');

  const { data: scores } = await sb
    .from('loan_intelligence_scores')
    .select('*')
    .eq('loan_id', loanId)
    .eq('org_id', orgId)
    .maybeSingle();

  return NextResponse.json({ ok: true, scores: scores ?? null });
}
