/**
 * Phase 129 — GET /api/intelligence/loan?loanId=<lead id>
 * Returns the current File Intelligence scores for a loan (org-scoped).
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

  const sb = createAdminClient();
  const { data: scores } = await sb
    .from('loan_intelligence_scores')
    .select('*')
    .eq('loan_id', loanId)
    .eq('org_id', orgId)
    .maybeSingle();

  return NextResponse.json({ scores: scores ?? null });
}
