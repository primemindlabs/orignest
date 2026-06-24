/**
 * Phase 147 — credit pull for one loan ([loanId] = lead id).
 *   GET  → this loan's credit-pull history (no raw report in the list)
 *   POST → run a pull { connection_id, pull_type, applicant }
 * Gated-safe: with no live vendor the attempt is recorded (status 'gated') and no
 * fake scores are returned.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { pullCredit } from '@/lib/creditPull/pull';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const LIST = 'id, vendor, pull_type, applicant, status, equifax_score, experian_score, transunion_score, mid_score, report_ref, tradeline_count, error_message, pulled_at, created_at';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('credit_report_pulls').select(LIST).eq('org_id', orgId).eq('lead_id', params.loanId).order('created_at', { ascending: false });
  return NextResponse.json({ pulls: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { connection_id?: string; pull_type?: string; applicant?: string };
  if (!b.connection_id) return NextResponse.json({ error: 'connection_id is required' }, { status: 400 });
  const pullType = b.pull_type === 'hard' ? 'hard' : 'soft';
  const applicant = ['borrower', 'coborrower', 'joint'].includes(b.applicant ?? '') ? (b.applicant as 'borrower' | 'coborrower' | 'joint') : 'borrower';

  const sb = createAdminClient();
  const { data: prof } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const outcome = await pullCredit(orgId, params.loanId, b.connection_id, (prof as { id?: string } | null)?.id ?? null, { pullType, applicant });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true, gated: outcome.gated, pull: outcome.pull });
}
