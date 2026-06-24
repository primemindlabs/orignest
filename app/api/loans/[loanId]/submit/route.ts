/**
 * Phase 143 — wholesale submission for one loan ([loanId] = lead id).
 *   GET  → this loan's submission history (no MISMO snapshot in the list payload)
 *   POST → submit the loan's MISMO 3.4 file to a chosen lender connection
 * Gated-safe: a submission with no live lender endpoint records the prepared file
 * and returns { gated: true } rather than faking a transmit.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { submitLoanToLender } from '@/lib/lenders/submission/submit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const LIST_COLS = 'id, lender_name, platform, status, external_loan_id, external_status, error_message, submitted_at, last_status_at, created_at';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data } = await sb.from('loan_submissions').select(LIST_COLS).eq('org_id', orgId).eq('lead_id', params.loanId).order('created_at', { ascending: false });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { connection_id } = (await req.json().catch(() => ({}))) as { connection_id?: string };
  if (!connection_id) return NextResponse.json({ error: 'connection_id is required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: prof } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const outcome = await submitLoanToLender(orgId, params.loanId, connection_id, prof?.id ?? null);
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });

  const { mismo_snapshot, ...submission } = outcome.submission as Record<string, any>;
  return NextResponse.json({ ok: true, gated: outcome.gated, submission });
}
