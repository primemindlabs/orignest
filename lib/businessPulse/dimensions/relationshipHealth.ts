/**
 * Pulse dimension — Relationship Health (25%).
 * % of scored realtors in Hot/Warm bands (Phase 95) + avg borrower heat (Phase 110,
 * latest snapshot per lead). Each side falls back to neutral when there's no data.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clamp, NEUTRAL, type DimensionResult } from '../types';

type RealtorHeat = {
  realtor_id: string;
  band: string;
  realtors: { first_name: string | null; last_name: string | null } | null;
};

export async function relationshipHealth(sb: SupabaseClient, orgId: string): Promise<DimensionResult> {
  const [{ data: realtorHeat }, { data: borrowerHeat }] = await Promise.all([
    sb.from('realtor_heat_scores').select('realtor_id, band, realtors(first_name, last_name)').eq('org_id', orgId),
    sb.from('borrower_heat_scores').select('lead_id, score, band, computed_at').eq('org_id', orgId).order('computed_at', { ascending: false }),
  ]);

  // ── Realtor side ──
  const realtors = (realtorHeat ?? []) as unknown as RealtorHeat[];
  const realtorsScored = realtors.length;
  const hotWarm = realtors.filter((r) => r.band === 'hot' || r.band === 'warm').length;
  const hotWarmPct = realtorsScored > 0 ? Math.round((hotWarm / realtorsScored) * 100) : null;
  const realtorScore = hotWarmPct ?? NEUTRAL;
  const coldRealtors = realtors
    .filter((r) => r.band === 'cold' || r.band === 'cooling')
    .map((r) => `${r.realtors?.first_name ?? ''} ${r.realtors?.last_name ?? ''}`.trim() || 'Realtor')
    .slice(0, 5);

  // ── Borrower side (latest snapshot per lead) ──
  const latestByLead = new Map<string, number>();
  for (const b of (borrowerHeat ?? []) as { lead_id: string; score: number }[]) {
    if (!latestByLead.has(b.lead_id)) latestByLead.set(b.lead_id, b.score);
  }
  const borrowersScored = latestByLead.size;
  const borrowerAvg = borrowersScored > 0
    ? Math.round([...latestByLead.values()].reduce((a, b) => a + b, 0) / borrowersScored)
    : null;
  const borrowerScore = borrowerAvg ?? NEUTRAL;

  // Weighted combine — fall back to whichever side has data.
  let score: number;
  if (hotWarmPct != null && borrowerAvg != null) score = Math.round(realtorScore * 0.6 + borrowerScore * 0.4);
  else if (hotWarmPct != null) score = realtorScore;
  else if (borrowerAvg != null) score = borrowerScore;
  else score = NEUTRAL;

  return {
    score: clamp(score),
    details: {
      realtors_scored: realtorsScored,
      realtors_hot_warm_pct: hotWarmPct,
      borrowers_scored: borrowersScored,
      borrower_heat_avg: borrowerAvg,
      cold_realtors: coldRealtors,
    },
  };
}
