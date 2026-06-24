/**
 * Phase 150 — VOI/VOE for one loan ([loanId] = lead id).
 *   GET  → this loan's verification history (no raw report in the list)
 *   POST → run a verification { connection_id, verification_type, method, applicant }
 * Gated-safe: with no live vendor the attempt is recorded (status 'gated') and no
 * fake figures are returned.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { runVoie } from '@/lib/voie/verify';
import type { VerificationType, VoieMethod } from '@/lib/voie/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const LIST = 'id, vendor, verification_type, method, applicant, status, verified, employer_name, job_title, employment_status, employment_start, employment_end, annual_income, monthly_income, pay_frequency, report_ref, error_message, verified_at, created_at';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('voie_verifications').select(LIST).eq('org_id', orgId).eq('lead_id', params.loanId).order('created_at', { ascending: false });
  return NextResponse.json({ verifications: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { connection_id?: string; verification_type?: string; method?: string; applicant?: string };
  if (!b.connection_id) return NextResponse.json({ error: 'connection_id is required' }, { status: 400 });
  const verificationType: VerificationType = ['income', 'employment', 'both'].includes(b.verification_type ?? '') ? (b.verification_type as VerificationType) : 'both';
  const method: VoieMethod = b.method === 'manual' ? 'manual' : 'instant';
  const applicant = b.applicant === 'coborrower' ? 'coborrower' : 'borrower';

  const sb = createAdminClient();
  const { data: prof } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const outcome = await runVoie(orgId, params.loanId, b.connection_id, (prof as { id?: string } | null)?.id ?? null, { verificationType, method, applicant });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true, gated: outcome.gated, verification: outcome.verification });
}
