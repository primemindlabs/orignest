/**
 * Phase 130 — Business Pulse orchestration. Runs the five weighted dimensions,
 * synthesizes insights, and persists one immutable row per org per day.
 *
 * The table is INSERT-only (update/delete revoked), so this does NOT upsert — it
 * inserts once per (org, day) and returns the cached row on subsequent calls.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bandFor, clamp, type PulseRow, type PulseScoreResult } from './types';
import { pipelineVelocity } from './dimensions/pipelineVelocity';
import { relationshipHealth } from './dimensions/relationshipHealth';
import { revenueTrajectory } from './dimensions/revenueTrajectory';
import { compliancePosture } from './dimensions/compliancePosture';
import { growthSignals } from './dimensions/growthSignals';
import { generatePulseInsights } from './generatePulseInsights';

const WEIGHTS = { pipeline: 0.3, relationship: 0.25, revenue: 0.25, compliance: 0.15, growth: 0.05 };

export async function computePulseScore(sb: SupabaseClient, orgId: string): Promise<PulseScoreResult> {
  const [pipeline, relationship, revenue, compliance, growth] = await Promise.all([
    pipelineVelocity(sb, orgId),
    relationshipHealth(sb, orgId),
    revenueTrajectory(sb, orgId),
    compliancePosture(sb, orgId),
    growthSignals(sb, orgId),
  ]);

  const pulseScore = clamp(
    Math.round(
      pipeline.score * WEIGHTS.pipeline +
        relationship.score * WEIGHTS.relationship +
        revenue.score * WEIGHTS.revenue +
        compliance.score * WEIGHTS.compliance +
        growth.score * WEIGHTS.growth,
    ),
  );
  const scoreBand = bandFor(pulseScore);

  const insights = await generatePulseInsights({ pulseScore, scoreBand, pipeline, relationship, revenue, compliance, growth });

  return {
    pulseScore,
    scoreBand,
    pipelineVelocityScore: pipeline.score,
    relationshipHealthScore: relationship.score,
    revenueTrajectoryScore: revenue.score,
    compliancePostureScore: compliance.score,
    growthSignalsScore: growth.score,
    pipelineDetails: pipeline.details,
    relationshipDetails: relationship.details,
    revenueDetails: revenue.details,
    complianceDetails: compliance.details,
    growthDetails: growth.details,
    keyInsights: insights.key,
    topRisks: insights.risks,
    topWins: insights.wins,
  };
}

/** Returns today's pulse row, computing + inserting it once if it doesn't exist yet. */
export async function ensureTodaysPulse(
  sb: SupabaseClient,
  orgId: string,
  branchManagerId: string,
): Promise<PulseRow> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await sb
    .from('business_pulse_scores')
    .select('*')
    .eq('org_id', orgId)
    .eq('score_date', today)
    .maybeSingle();
  if (existing) return existing as PulseRow;

  const r = await computePulseScore(sb, orgId);
  const row = {
    org_id: orgId,
    branch_manager_id: branchManagerId,
    pulse_score: r.pulseScore,
    score_band: r.scoreBand,
    pipeline_velocity_score: r.pipelineVelocityScore,
    relationship_health_score: r.relationshipHealthScore,
    revenue_trajectory_score: r.revenueTrajectoryScore,
    compliance_posture_score: r.compliancePostureScore,
    growth_signals_score: r.growthSignalsScore,
    pipeline_details: r.pipelineDetails,
    relationship_details: r.relationshipDetails,
    revenue_details: r.revenueDetails,
    compliance_details: r.complianceDetails,
    growth_details: r.growthDetails,
    key_insights: r.keyInsights,
    top_risks: r.topRisks,
    top_wins: r.topWins,
    score_date: today,
  };

  const { data, error } = await sb.from('business_pulse_scores').insert(row).select().single();
  if (error) {
    // Lost a race (unique org_id+score_date) — return the row the other writer made.
    const { data: again } = await sb
      .from('business_pulse_scores')
      .select('*')
      .eq('org_id', orgId)
      .eq('score_date', today)
      .maybeSingle();
    if (again) return again as PulseRow;
    throw error;
  }
  return data as PulseRow;
}
