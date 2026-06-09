/**
 * Phase 30.1 — Condition Prediction API (LO-only; never exposed to portal routes).
 *   GET  → latest persisted predictions for the loan (+ accuracy on recent files)
 *   POST → regenerate predictions with Claude Sonnet and persist a new row
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLoanSummary } from '@/lib/loans/getLoanSummary';
import {
  predictConditions,
  patternKeyFor,
  type UWOutcomePattern,
} from '@/lib/ai/conditionPredictor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: latest } = await sb
    .from('predicted_conditions')
    .select('*')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Rolling accuracy across this LO/org's recently scored files.
  const { data: scored } = await sb
    .from('predicted_conditions')
    .select('accuracy_score')
    .eq('org_id', orgId)
    .not('accuracy_score', 'is', null)
    .order('generated_at', { ascending: false })
    .limit(12);

  const accuracySamples = (scored ?? []).map((r) => Number(r.accuracy_score)).filter((n) => !Number.isNaN(n));
  const rollingAccuracy =
    accuracySamples.length > 0
      ? Math.round((accuracySamples.reduce((a, b) => a + b, 0) / accuracySamples.length) * 100)
      : null;

  return NextResponse.json({ prediction: latest ?? null, rollingAccuracy, accuracySampleSize: accuracySamples.length });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  // Mark-as-reviewed action (no regeneration).
  let action: string | undefined;
  try {
    action = ((await req.json()) as { action?: string }).action;
  } catch {
    /* no body → regenerate */
  }

  const sb = createAdminClient();

  if (action === 'mark_reviewed') {
    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    const { data: latest } = await sb
      .from('predicted_conditions')
      .select('id')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) return NextResponse.json({ error: 'No prediction to review' }, { status: 404 });
    await sb
      .from('predicted_conditions')
      .update({ lo_reviewed: true, lo_reviewed_at: new Date().toISOString(), lo_reviewed_by: profile?.id ?? null })
      .eq('id', latest.id);
    return NextResponse.json({ ok: true });
  }

  // Regenerate.
  const loan = await getLoanSummary(params.loanId);
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  // Load the matching learned pattern. patternKeyFor must use the RAW
  // leads.loan_type / occupancy_type / ltv to match learn_uw_patterns().
  const { data: leadRow } = await sb
    .from('leads')
    .select('loan_type, occupancy_type, ltv, credit_score')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();

  const realKey = patternKeyFor(leadRow?.loan_type, leadRow?.occupancy_type, leadRow?.ltv);
  let pattern: UWOutcomePattern | null = null;
  const { data: patternRow } = await sb
    .from('uw_outcome_patterns')
    .select('pattern_key, loan_count, common_conditions')
    .eq('org_id', orgId)
    .eq('pattern_key', realKey)
    .maybeSingle();
  if (patternRow) {
    pattern = {
      pattern_key: patternRow.pattern_key,
      loan_count: patternRow.loan_count,
      common_conditions: Array.isArray(patternRow.common_conditions) ? patternRow.common_conditions : [],
    };
  }

  let predictions;
  try {
    predictions = await predictConditions({
      context: loan.context,
      loanAmount: loan.loanAmount,
      dti: loan.dti,
      creditScore: leadRow?.credit_score ?? null,
      downPaymentSource: null,
      patterns: pattern,
    });
  } catch (err) {
    console.error('[predict-conditions] generation failed', err);
    return NextResponse.json({ error: 'Prediction generation failed' }, { status: 502 });
  }

  const { data: inserted, error } = await sb
    .from('predicted_conditions')
    .insert({
      lead_id: params.loanId,
      org_id: orgId,
      model_version: 'claude-sonnet-4-5',
      predictions,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[predict-conditions] insert failed', error);
    return NextResponse.json({ error: 'Failed to save prediction' }, { status: 500 });
  }

  return NextResponse.json({ prediction: inserted, basedOnPattern: pattern ? pattern.loan_count : 0 });
}
