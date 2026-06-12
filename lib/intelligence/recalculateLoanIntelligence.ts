/**
 * Phase 129 — File Intelligence recalculation (DB wrapper around the pure engine).
 *
 * Adapted to the real schema: loans are `leads` (LO = leads.assigned_to), the
 * spec's `conditions` are `loan_conditions` (status 'cleared' = satisfied), and
 * documents link by lead_id. Fetches current state, runs computeFileIntelligence,
 * upserts loan_intelligence_scores, and appends an immutable history row.
 *
 * Best-effort: callers invoke this AFTER their primary mutation and should not
 * block on it. Returns null when the loan is missing or unassigned.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import {
  computeFileIntelligence,
  normalizeLoanType,
  type FileIntelligenceResult,
  type IntelCondition,
  type LoanStage,
} from '@/lib/intelligence/computeFileIntelligence';

type Admin = ReturnType<typeof createAdminClient>;
const DAY = 86_400_000;

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / DAY));
}

/** Most recent of any activity timestamp on the lead. */
function lastActivityIso(lead: Record<string, unknown>): string | null {
  const candidates = [lead.last_contacted_at, lead.stage_changed_at, lead.updated_at, lead.created_at]
    .filter(Boolean) as string[];
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (new Date(a).getTime() >= new Date(b).getTime() ? a : b));
}

/** Org's average calendar days from creation to close for the same loan type (null if none). */
async function getOrgAvgDaysToClose(sb: Admin, orgId: string, loanType: string | null): Promise<number | null> {
  let q = sb
    .from('leads')
    .select('created_at, closing_date')
    .eq('org_id', orgId)
    .eq('stage', 'closed')
    .not('closing_date', 'is', null)
    .limit(200);
  if (loanType) q = q.eq('loan_type', loanType);
  const { data } = await q;
  const spans = (data ?? [])
    .map((r) => (new Date(r.closing_date as string).getTime() - new Date(r.created_at as string).getTime()) / DAY)
    .filter((d) => isFinite(d) && d > 0);
  if (spans.length === 0) return null;
  return Math.round(spans.reduce((a, b) => a + b, 0) / spans.length);
}

export async function recalculateLoanIntelligence(
  sb: Admin,
  loanId: string,
  triggerEvent: 'condition_update' | 'stage_change' | 'document_upload' | 'nightly_refresh' | 'manual_refresh',
): Promise<FileIntelligenceResult | null> {
  const { data: lead } = await sb
    .from('leads')
    .select('id, org_id, assigned_to, stage, loan_type, created_at, last_contacted_at, stage_changed_at, updated_at')
    .eq('id', loanId)
    .maybeSingle();
  if (!lead) return null;

  const orgId = lead.org_id as string;
  const loId = lead.assigned_to as string | null;

  const [{ data: conditions }, { data: documents }, historicalAvgDaysToClose] = await Promise.all([
    sb.from('loan_conditions').select('condition_text, status, created_at').eq('lead_id', loanId),
    sb.from('documents').select('document_type').eq('lead_id', loanId),
    getOrgAvgDaysToClose(sb, orgId, lead.loan_type as string | null),
  ]);

  // Map loan_conditions -> the engine's condition shape.
  const mappedConditions: IntelCondition[] = (conditions ?? []).map((c) => ({
    name: (c.condition_text as string) ?? 'Condition',
    // 'suspended' conditions are on hold — not currently required for UW.
    required_for_uw: c.status !== 'suspended',
    status: c.status === 'cleared' ? 'satisfied' : 'outstanding',
    age_days: daysSince(c.created_at as string),
  }));

  const result = computeFileIntelligence({
    loan: { id: loanId, stage: lead.stage as LoanStage },
    conditions: mappedConditions,
    documents: (documents ?? []).map((d) => ({ document_type: (d.document_type as string) ?? '' })),
    stage: lead.stage as LoanStage,
    daysSinceCreation: daysSince(lead.created_at as string),
    daysSinceLastActivity: daysSince(lastActivityIso(lead)),
    loanType: normalizeLoanType(lead.loan_type as string),
    historicalAvgDaysToClose,
  });

  const predictedDate = result.predictedCloseDate?.toISOString().split('T')[0] ?? null;

  // Upsert the current score (scores.lo_id is NOT NULL — only write when assigned).
  if (loId) {
    await sb.from('loan_intelligence_scores').upsert(
      {
        loan_id: loanId,
        org_id: orgId,
        lo_id: loId,
        file_health_score: result.fileHealthScore,
        close_probability: result.closeProbability,
        uw_readiness_score: result.uwReadinessScore,
        predicted_close_date: predictedDate,
        predicted_close_confidence: result.predictedCloseConfidence,
        fallout_flags: result.falloutFlags,
        health_drivers: result.healthDrivers,
        uw_drivers: result.uwDrivers,
        computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'loan_id' },
    );
  }

  // Append to history (INSERT-only; lo_id nullable here).
  await sb.from('loan_intelligence_history').insert({
    loan_id: loanId,
    org_id: orgId,
    lo_id: loId,
    file_health_score: result.fileHealthScore,
    close_probability: result.closeProbability,
    uw_readiness_score: result.uwReadinessScore,
    predicted_close_date: predictedDate,
    fallout_flag_count: result.falloutFlags.length,
    trigger_event: triggerEvent,
  });

  return result;
}
