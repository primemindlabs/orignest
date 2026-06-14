/**
 * Phase 130 — Business Pulse™ shared types.
 * Adapted to the real stack: branch_manager_id→profiles(id), org-scoped, computed
 * LIVE from leads/profiles/heat-scores/intelligence/trid. The table is INSERT-only
 * (one row per org per day) — never updated, so a day's score is immutable.
 */

export type ScoreBand = 'green' | 'yellow' | 'orange' | 'red';

/** Neutral baseline used when a data source is empty (fresh org) — avoids fake reds. */
export const NEUTRAL = 70;

export interface DimensionResult {
  score: number; // 0–100
  details: Record<string, unknown>;
}

export interface PulseInsights {
  key: string[];
  risks: string[];
  wins: string[];
}

export interface PulseScoreResult {
  pulseScore: number;
  scoreBand: ScoreBand;
  pipelineVelocityScore: number;
  relationshipHealthScore: number;
  revenueTrajectoryScore: number;
  compliancePostureScore: number;
  growthSignalsScore: number;
  pipelineDetails: Record<string, unknown>;
  relationshipDetails: Record<string, unknown>;
  revenueDetails: Record<string, unknown>;
  complianceDetails: Record<string, unknown>;
  growthDetails: Record<string, unknown>;
  keyInsights: string[];
  topRisks: string[];
  topWins: string[];
}

/** The persisted DB row shape (snake_case) returned to the API/UI. */
export interface PulseRow {
  id: string;
  org_id: string;
  branch_manager_id: string;
  pulse_score: number;
  score_band: ScoreBand;
  pipeline_velocity_score: number | null;
  relationship_health_score: number | null;
  revenue_trajectory_score: number | null;
  compliance_posture_score: number | null;
  growth_signals_score: number | null;
  pipeline_details: Record<string, unknown>;
  relationship_details: Record<string, unknown>;
  revenue_details: Record<string, unknown>;
  compliance_details: Record<string, unknown>;
  growth_details: Record<string, unknown>;
  key_insights: string[];
  top_risks: string[];
  top_wins: string[];
  computed_at: string;
  score_date: string;
}

export function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}

export function bandFor(score: number): ScoreBand {
  return score >= 85 ? 'green' : score >= 65 ? 'yellow' : score >= 40 ? 'orange' : 'red';
}
