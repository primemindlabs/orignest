/**
 * Phase 30.6 — single-loan velocity prediction (LO "Update Prediction" button).
 *   GET  → latest persisted prediction
 *   POST → regenerate now
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { runVelocityPrediction } from '@/lib/ai/runVelocityPrediction';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb
    .from('velocity_predictions')
    .select('*')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ prediction: data ?? null });
}

export async function POST(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const result = await runVelocityPrediction(sb, orgId, params.loanId);
  if (!result.ok) return NextResponse.json({ error: result.error ?? 'failed' }, { status: 502 });
  const { data } = await sb
    .from('velocity_predictions')
    .select('*')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ prediction: data });
}
