/**
 * Phase 151 — AUS (DU/LPA) for one loan ([loanId] = lead id).
 *   GET  → this loan's AUS run history (no raw response / MISMO snapshot in the list)
 *   POST → run an AUS submission { connection_id, aus_system }
 * Gated-safe: with no live AUS the attempt is recorded (status 'gated') with the MISMO
 * snapshot and no fake recommendation is returned.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { runAus } from '@/lib/aus/submit';
import type { AusSystem } from '@/lib/aus/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LIST = 'id, vendor, aus_system, status, recommendation, raw_recommendation, eligibility, risk_class, case_file_id, dti, ltv, findings, report_ref, error_message, submitted_at, created_at';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('aus_submissions').select(LIST).eq('org_id', orgId).eq('lead_id', params.loanId).order('created_at', { ascending: false });
  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { connection_id?: string; aus_system?: string };
  if (!b.connection_id) return NextResponse.json({ error: 'connection_id is required' }, { status: 400 });
  const system: AusSystem = b.aus_system === 'lpa' ? 'lpa' : 'du';

  const sb = createAdminClient();
  const { data: prof } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

  const outcome = await runAus(orgId, params.loanId, b.connection_id, (prof as { id?: string } | null)?.id ?? null, { system });
  if (!outcome.ok) return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  return NextResponse.json({ ok: true, gated: outcome.gated, submission: outcome.submission });
}
