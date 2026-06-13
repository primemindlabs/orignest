/**
 * Phase 30.6 — gather inputs, call the velocity model, persist one prediction.
 * Shared by the on-demand route and the daily cron batch route.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { deriveLoanContext } from '@/lib/ui/fieldAdapter';
import { patternKeyFor } from '@/lib/ai/conditionPredictor';
import { predictCloseDate } from '@/lib/ai/velocityPredictor';

export async function runVelocityPrediction(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  leadId: string
): Promise<{ ok: boolean; risk_level?: string; error?: string }> {
  const { data: lead } = await sb
    .from('leads')
    .select('id, stage, stage_changed_at, created_at, closing_date, loan_type, loan_purpose, occupancy_type, property_type, loan_amount, down_payment, estimated_value, ltv')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return { ok: false, error: 'Loan not found' };

  const [{ data: conditions }, { data: appRow }, { data: behavior }, { data: pattern }] = await Promise.all([
    sb.from('loan_conditions').select('category, condition_text').eq('lead_id', leadId).neq('status', 'cleared'),
    sb.from('loan_applications').select('borrower_data, employment_data').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('borrower_behavior_scores').select('score').eq('lead_id', leadId).maybeSingle(),
    sb.from('uw_outcome_patterns').select('avg_days_total_uw').eq('org_id', orgId).eq('pattern_key', patternKeyFor(lead.loan_type, lead.occupancy_type, lead.ltv)).maybeSingle(),
  ]);

  const borrowerData = (appRow?.borrower_data ?? {}) as Record<string, unknown>;
  const employmentData = (appRow?.employment_data ?? {}) as Record<string, unknown>;
  const context = deriveLoanContext(lead, {
    has_co_borrower: !!borrowerData.has_co_borrower || !!borrowerData.co_borrower_section,
    has_reo: !!borrowerData.has_reo,
    employment_type: (employmentData.employment_type as string) ?? null,
  });

  const todayISO = new Date().toISOString().slice(0, 10);
  const since = lead.stage_changed_at ?? lead.created_at;
  const daysInCurrentStage = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000));

  let prediction;
  try {
    prediction = await predictCloseDate({
      stage: lead.stage,
      daysInCurrentStage,
      targetCloseDate: lead.closing_date ?? null,
      openConditions: (conditions ?? []).map((c) => ({ category: c.category, condition_text: c.condition_text })),
      loanProgram: context.loan_program,
      employmentType: context.employment_type,
      behaviorScore: behavior?.score ?? null,
      avgDaysTotalUw: pattern?.avg_days_total_uw ?? null,
      todayISO,
    });
  } catch (err) {
    console.error('[velocity] generation failed for', leadId, err);
    return { ok: false, error: 'generation_failed' };
  }

  const { error } = await sb.from('velocity_predictions').insert({
    lead_id: leadId,
    org_id: orgId,
    predicted_close_date: prediction.predicted_close_date,
    confidence_interval_days: prediction.confidence_interval_days,
    days_behind_typical: prediction.days_behind_typical,
    risk_level: prediction.risk_level,
    risk_factors: prediction.risk_factors,
    recommendation: prediction.recommendation,
    model_input: { stage: lead.stage, daysInCurrentStage, openConditions: (conditions ?? []).length, behaviorScore: behavior?.score ?? null, benchmark: pattern?.avg_days_total_uw ?? null },
  });
  if (error) {
    console.error('[velocity] insert failed', error);
    return { ok: false, error: 'insert_failed' };
  }
  return { ok: true, risk_level: prediction.risk_level };
}
