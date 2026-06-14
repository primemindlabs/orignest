/**
 * Pulse dimension — Revenue Trajectory (25%).
 * Pace-adjusted projected MTD volume vs target (Σ monthly_volume_goal, falling back
 * to the prior-90-day average month), plus trend vs prior 90 days. Gross comp uses
 * leads.loan_amount × profiles.comp_rate/100 (the established P98 formula).
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clamp, NEUTRAL, type DimensionResult } from '../types';

const DAY = 86_400_000;

export async function revenueTrajectory(sb: SupabaseClient, orgId: string): Promise<DimensionResult> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const cut90 = new Date(now.getTime() - 90 * DAY);

  const [{ data: profiles }, { data: closed }] = await Promise.all([
    sb.from('profiles').select('id, comp_rate, monthly_volume_goal').eq('org_id', orgId),
    sb
      .from('leads')
      .select('assigned_to, loan_amount, closed_date')
      .eq('org_id', orgId)
      .eq('stage', 'closed')
      .gte('closed_date', cut90.toISOString().slice(0, 10)),
  ]);

  const compRate = new Map((profiles ?? []).map((p: any) => [p.id as string, Number(p.comp_rate ?? 0.5)]));
  const targetVolume = (profiles ?? []).reduce((s: number, p: any) => s + Number(p.monthly_volume_goal ?? 0), 0);

  const startMonthStr = startOfMonth.toISOString().slice(0, 10);
  let mtdVolume = 0;
  let mtdComp = 0;
  let fundedMtd = 0;
  let prior90Volume = 0;
  for (const l of (closed ?? []) as { assigned_to: string | null; loan_amount: number | null; closed_date: string | null }[]) {
    const amt = Number(l.loan_amount ?? 0);
    if (!l.closed_date) continue;
    if (l.closed_date >= startMonthStr) {
      mtdVolume += amt;
      fundedMtd++;
      mtdComp += (amt * (compRate.get(l.assigned_to ?? '') ?? 0.5)) / 100;
    } else {
      prior90Volume += amt;
    }
  }
  const priorAvgMonthly = prior90Volume / 3;

  // Pace-adjust MTD to a full-month projection.
  const dayOfMonth = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const monthFrac = Math.max(dayOfMonth / daysInMonth, 0.1);
  const projectedMonthVolume = mtdVolume / monthFrac;

  const target = targetVolume > 0 ? targetVolume : priorAvgMonthly;

  let score: number;
  if (target > 0) {
    const paceScore = clamp((projectedMonthVolume / target) * 100);
    const trendScore = priorAvgMonthly > 0 ? clamp((projectedMonthVolume / priorAvgMonthly) * 100) : paceScore;
    score = Math.round(paceScore * 0.6 + trendScore * 0.4);
  } else {
    score = NEUTRAL; // brand-new branch: no target, no history
  }

  return {
    score: clamp(score),
    details: {
      mtd_volume: Math.round(mtdVolume),
      mtd_comp: Math.round(mtdComp),
      funded_count_mtd: fundedMtd,
      projected_month_volume: Math.round(projectedMonthVolume),
      target_volume: Math.round(target),
      prior_90d_avg_monthly: Math.round(priorAvgMonthly),
    },
  };
}
