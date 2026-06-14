/**
 * Phase 130 — benchmark comparison. The "your branch" column is computed live; the
 * industry median / top-quartile columns are static constants for now (cross-org
 * anonymized aggregation is deferred — it needs an opt-in monthly job we don't run yet).
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const DAY = 86_400_000;

export const INDUSTRY_BENCHMARKS = {
  avg_days_to_close: { median: 32, top_quartile: 24, lowerIsBetter: true },
  realtor_hot_warm_pct: { median: 48, top_quartile: 72, lowerIsBetter: false },
  trid_compliance_pct: { median: 94, top_quartile: 100, lowerIsBetter: false },
} as const;

export interface BenchmarkRow {
  label: string;
  unit: string;
  yours: number | null;
  median: number;
  topQuartile: number;
  lowerIsBetter: boolean;
}

export async function computeOrgBenchmarkMetrics(
  sb: SupabaseClient,
  orgId: string,
): Promise<{ avgDaysToClose: number | null; realtorHotWarmPct: number | null; tridCompliancePct: number | null }> {
  const cut180 = new Date(Date.now() - 180 * DAY).toISOString().slice(0, 10);

  const [{ data: closed }, { data: realtorHeat }, { data: trid }] = await Promise.all([
    sb.from('leads').select('created_at, closed_date').eq('org_id', orgId).eq('stage', 'closed').gte('closed_date', cut180),
    sb.from('realtor_heat_scores').select('band').eq('org_id', orgId),
    sb.from('trid_events').select('is_compliant').eq('org_id', orgId),
  ]);

  // Avg days to close.
  const closedRows = (closed ?? []) as { created_at: string; closed_date: string | null }[];
  const spans = closedRows
    .filter((l) => l.closed_date)
    .map((l) => (new Date(l.closed_date as string).getTime() - new Date(l.created_at).getTime()) / DAY)
    .filter((d) => d >= 0);
  const avgDaysToClose = spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : null;

  // Realtor Hot/Warm %.
  const realtors = (realtorHeat ?? []) as { band: string }[];
  const realtorHotWarmPct = realtors.length
    ? Math.round((realtors.filter((r) => r.band === 'hot' || r.band === 'warm').length / realtors.length) * 100)
    : null;

  // TRID compliance %.
  const tridRows = (trid ?? []) as { is_compliant: boolean }[];
  const tridCompliancePct = tridRows.length
    ? Math.round((tridRows.filter((t) => t.is_compliant).length / tridRows.length) * 100)
    : null;

  return { avgDaysToClose, realtorHotWarmPct, tridCompliancePct };
}

export function buildBenchmarkRows(m: { avgDaysToClose: number | null; realtorHotWarmPct: number | null; tridCompliancePct: number | null }): BenchmarkRow[] {
  return [
    {
      label: 'Avg Days to Close',
      unit: 'days',
      yours: m.avgDaysToClose,
      median: INDUSTRY_BENCHMARKS.avg_days_to_close.median,
      topQuartile: INDUSTRY_BENCHMARKS.avg_days_to_close.top_quartile,
      lowerIsBetter: true,
    },
    {
      label: 'Realtor Hot/Warm',
      unit: '%',
      yours: m.realtorHotWarmPct,
      median: INDUSTRY_BENCHMARKS.realtor_hot_warm_pct.median,
      topQuartile: INDUSTRY_BENCHMARKS.realtor_hot_warm_pct.top_quartile,
      lowerIsBetter: false,
    },
    {
      label: 'TRID Compliance',
      unit: '%',
      yours: m.tridCompliancePct,
      median: INDUSTRY_BENCHMARKS.trid_compliance_pct.median,
      topQuartile: INDUSTRY_BENCHMARKS.trid_compliance_pct.top_quartile,
      lowerIsBetter: false,
    },
  ];
}
