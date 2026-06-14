'use client';

import { PulseScoreHero } from './PulseScoreHero';
import { PulseTrendChart } from './PulseTrendChart';
import { PulseDimensionPanel, type DimRow, type DimList } from './PulseDimensionPanel';
import { PulseBenchmarkTable } from './PulseBenchmarkTable';
import type { PulseRow } from '@/lib/businessPulse/types';
import type { BenchmarkRow } from '@/lib/businessPulse/benchmarks';

type Props = {
  score: PulseRow;
  history: { score_date: string; pulse_score: number }[];
  benchmarks: BenchmarkRow[];
};

function money(n: unknown): string {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v)}`;
}
const pct = (n: unknown) => (n == null ? '—' : `${n}%`);
const num = (n: unknown) => (n == null ? '—' : String(n));

export function PulsePageClient({ score, history, benchmarks }: Props) {
  const p = (score.pipeline_details ?? {}) as any;
  const r = (score.relationship_details ?? {}) as any;
  const rev = (score.revenue_details ?? {}) as any;
  const c = (score.compliance_details ?? {}) as any;
  const g = (score.growth_details ?? {}) as any;

  const pipelineRows: DimRow[] = [
    { label: 'Active files', value: num(p.active_count) },
    { label: 'Avg days in stage', value: p.avg_stage_age_days == null ? '—' : `${p.avg_stage_age_days}d` },
    { label: 'Stage benchmark', value: `${p.benchmark_days ?? 8}d` },
    { label: 'At fallout risk', value: num(p.at_risk_count) },
  ];
  const pipelineLists: DimList[] = [
    { label: 'Stalled files', items: (p.stale_files ?? []).map((f: any) => `${f.name} — ${String(f.stage).replace(/_/g, ' ')} (${f.days}d)`) },
  ];

  const relationshipRows: DimRow[] = [
    { label: 'Realtors scored', value: num(r.realtors_scored) },
    { label: 'Hot/Warm', value: pct(r.realtors_hot_warm_pct) },
    { label: 'Borrowers scored', value: num(r.borrowers_scored) },
    { label: 'Avg borrower heat', value: r.borrower_heat_avg == null ? '—' : `${r.borrower_heat_avg}/100` },
  ];
  const relationshipLists: DimList[] = [
    { label: 'Cooling partners', items: r.cold_realtors ?? [] },
  ];

  const revenueRows: DimRow[] = [
    { label: 'MTD volume', value: money(rev.mtd_volume) },
    { label: 'MTD commission', value: money(rev.mtd_comp) },
    { label: 'Funded MTD', value: num(rev.funded_count_mtd) },
    { label: 'Projected month', value: money(rev.projected_month_volume) },
    { label: 'Target', value: money(rev.target_volume) },
    { label: 'Prior 90d avg/mo', value: money(rev.prior_90d_avg_monthly) },
  ];

  const complianceRows: DimRow[] = [
    { label: 'TRID compliance', value: pct(c.trid_compliance_pct) },
    { label: 'TRID events', value: num(c.trid_event_count) },
    { label: 'LOs', value: num(c.los_total) },
    { label: 'NMLS current', value: pct(c.nmls_current_pct) },
    { label: 'Training complete', value: pct(c.training_completion_pct) },
  ];

  const growthRows: DimRow[] = [
    { label: 'New partners MTD', value: num(g.new_realtors_mtd) },
    { label: 'New leads MTD', value: num(g.new_leads_mtd) },
    { label: 'Prior month leads', value: num(g.prior_month_leads) },
    { label: 'Referral share', value: pct(g.referral_share_pct) },
  ];

  return (
    <div className="space-y-5 max-w-5xl">
      <PulseScoreHero score={score} />

      {(score.key_insights ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-[#E8E4DE] px-5 py-4">
          <p className="text-xs font-medium text-[#6B7B8D] uppercase tracking-wide mb-2">Key insights</p>
          <ul className="space-y-1.5">
            {(score.key_insights ?? []).map((k, i) => (
              <li key={i} className="text-sm text-[#4A4A4A] flex items-start gap-1.5">
                <span className="text-[#C9A95C]">•</span> {k}
              </li>
            ))}
          </ul>
        </div>
      )}

      <PulseTrendChart history={history} />

      <div className="space-y-2.5">
        <PulseDimensionPanel label="Pipeline Velocity" weight="30%" score={score.pipeline_velocity_score} rows={pipelineRows} lists={pipelineLists} />
        <PulseDimensionPanel label="Relationship Health" weight="25%" score={score.relationship_health_score} rows={relationshipRows} lists={relationshipLists} />
        <PulseDimensionPanel label="Revenue Trajectory" weight="25%" score={score.revenue_trajectory_score} rows={revenueRows} />
        <PulseDimensionPanel label="Compliance Posture" weight="15%" score={score.compliance_posture_score} rows={complianceRows} />
        <PulseDimensionPanel label="Growth Signals" weight="5%" score={score.growth_signals_score} rows={growthRows} />
      </div>

      <PulseBenchmarkTable rows={benchmarks} />
    </div>
  );
}
