/**
 * Phase 99 — funnel computation from the stage_transitions audit log. Shared by
 * the live GET route and the weekly cron. Cohort logic: conversion A→B =
 * leads_entering_B / leads_entering_A (stalled leads stay in A's denominator).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { FUNNEL_STAGES, FUNNEL_STAGE_LABELS, isFunnelStage } from '@/lib/funnel/stages';
import { detectBottleneck } from '@/lib/funnel/bottleneck';

type Admin = ReturnType<typeof createAdminClient>;
const DAY = 86_400_000;

export interface FunnelStageData {
  name: string;
  label: string;
  entered_count: number;
  exited_count: number;
  conversion_pct: number | null;
  avg_days_in_stage: number | null;
}

export interface FunnelResult {
  period_days: number;
  period_end: string;
  stages: FunnelStageData[];
  bottleneck_stage: string | null;
  bottleneck_conversion_pct: number | null;
}

export async function computeFunnel(sb: Admin, orgId: string, loId: string, periodDays: number): Promise<FunnelResult> {
  const periodStart = new Date(Date.now() - periodDays * DAY).toISOString();

  const { data: transitions } = await sb
    .from('stage_transitions')
    .select('lead_id, to_stage, days_in_prior_stage')
    .eq('org_id', orgId)
    .eq('lo_id', loId)
    .gte('transitioned_at', periodStart);

  const entered: Record<string, Set<string>> = {};
  const days: Record<string, number[]> = {};
  for (const s of FUNNEL_STAGES) { entered[s] = new Set(); days[s] = []; }

  for (const t of transitions ?? []) {
    const to = t.to_stage as string;
    if (!isFunnelStage(to)) continue;
    entered[to].add(t.lead_id as string);
    if (t.days_in_prior_stage != null) days[to].push(t.days_in_prior_stage as number);
  }

  const stages: FunnelStageData[] = FUNNEL_STAGES.map((stage, i) => {
    const enteredCount = entered[stage].size;
    const next = FUNNEL_STAGES[i + 1] ?? null;
    const exited = next ? entered[next].size : null;
    const conversion = next && enteredCount > 0
      ? parseFloat(((entered[next].size / enteredCount) * 100).toFixed(2))
      : null;
    const d = days[stage];
    const avgDays = d.length >= 3 ? parseFloat((d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)) : null;
    return {
      name: stage,
      label: FUNNEL_STAGE_LABELS[stage],
      entered_count: enteredCount,
      exited_count: exited ?? 0,
      conversion_pct: conversion,
      avg_days_in_stage: avgDays,
    };
  });

  const bottleneck = detectBottleneck(stages);
  const bottleneckStage = stages.find((s) => s.name === bottleneck) ?? null;

  return {
    period_days: periodDays,
    period_end: new Date().toISOString().split('T')[0],
    stages,
    bottleneck_stage: bottleneck,
    bottleneck_conversion_pct: bottleneckStage?.conversion_pct ?? null,
  };
}
