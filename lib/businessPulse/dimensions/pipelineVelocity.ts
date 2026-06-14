/**
 * Pulse dimension — Pipeline Velocity (30%).
 * Avg days-in-current-stage vs benchmark + at-risk share (from Phase 129 File
 * Intelligence). No 'denied'/'withdrawn' stage exists in the data, so fallout is
 * proxied by low close_probability rather than terminal-stage counts.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clamp, NEUTRAL, type DimensionResult } from '../types';

const ACTIVE_PIPELINE = ['application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
const BENCHMARK_STAGE_DAYS = 8; // expected avg days in current stage
const DAY = 86_400_000;

export async function pipelineVelocity(sb: SupabaseClient, orgId: string): Promise<DimensionResult> {
  const now = Date.now();
  const [{ data: leads }, { data: intel }] = await Promise.all([
    sb
      .from('leads')
      .select('id, first_name, last_name, stage, stage_changed_at, created_at')
      .eq('org_id', orgId)
      .is('archived_at', null)
      .in('stage', ACTIVE_PIPELINE),
    sb.from('loan_intelligence_scores').select('loan_id, close_probability').eq('org_id', orgId),
  ]);

  const active = (leads ?? []) as { id: string; first_name: string | null; last_name: string | null; stage: string; stage_changed_at: string | null; created_at: string }[];
  const activeCount = active.length;

  if (activeCount === 0) {
    return { score: NEUTRAL, details: { active_count: 0, avg_stage_age_days: null, at_risk_count: 0, benchmark_days: BENCHMARK_STAGE_DAYS, stale_files: [] } };
  }

  // Avg age in current stage.
  const ages = active.map((l) => Math.floor((now - new Date(l.stage_changed_at ?? l.created_at).getTime()) / DAY));
  const avgAge = ages.reduce((a, b) => a + b, 0) / activeCount;
  // 100 at/under benchmark, ~-4pts per day over.
  const ageScore = clamp(100 - Math.max(0, avgAge - BENCHMARK_STAGE_DAYS) * 4);

  // At-risk share from File Intelligence (close_probability < 0.30).
  const probByLoan = new Map((intel ?? []).map((r: any) => [r.loan_id as string, r.close_probability as number | null]));
  let atRisk = 0;
  let scored = 0;
  for (const l of active) {
    const p = probByLoan.get(l.id);
    if (p == null) continue;
    scored++;
    if (p < 0.3) atRisk++;
  }
  const riskScore = scored > 0 ? clamp(100 - (atRisk / scored) * 150) : NEUTRAL;

  const score = scored > 0 ? Math.round(ageScore * 0.6 + riskScore * 0.4) : Math.round(ageScore);

  const staleFiles = active
    .map((l, i) => ({ name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Borrower', stage: l.stage, days: ages[i] }))
    .filter((f) => f.days >= 10)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  return {
    score: clamp(score),
    details: {
      active_count: activeCount,
      avg_stage_age_days: Math.round(avgAge * 10) / 10,
      benchmark_days: BENCHMARK_STAGE_DAYS,
      at_risk_count: atRisk,
      scored_count: scored,
      stale_files: staleFiles,
    },
  };
}
