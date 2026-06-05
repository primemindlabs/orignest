'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line,
  LineChart, CartesianGrid, Cell, ComposedChart, Legend, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2, Percent,
  Target, Users, Clock, ChevronDown, Sparkles, RefreshCw,
  AlertCircle, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────

interface ClosedLoan {
  loan_amount: number;
  close_date: string;
  loan_type: string;
  source: string;
  assigned_to: string;
  lo_name: string;
}

interface RevenueProps {
  closedLoans: ClosedLoan[];
  activeLeadsCount: number;
  avgHistoricalCloseRate: number;
  avgLoanSize: number;
  orgSettings: { basis_points: number; monthly_goal: number } | null;
}

// ── Stage probability weights ──────────────────────────────────────────
const STAGE_WEIGHTS: Record<string, number> = {
  pre_qualified: 0.20,
  application_started: 0.30,
  application_complete: 0.40,
  processing: 0.60,
  underwriting: 0.75,
  conditional_approval: 0.90,
  clear_to_close: 0.98,
  closing_scheduled: 0.98,
};

// ── Sample data (shown when no real data) ──────────────────────────────
const SAMPLE_MONTHS = [
  { month: 'Jul', conventional: 2100000, fha_va: 950000, nonqm: 380000, commercial: 0, units: 12 },
  { month: 'Aug', conventional: 2450000, fha_va: 1100000, nonqm: 420000, commercial: 0, units: 14 },
  { month: 'Sep', conventional: 1980000, fha_va: 890000, nonqm: 490000, commercial: 650000, units: 13 },
  { month: 'Oct', conventional: 2700000, fha_va: 1200000, nonqm: 310000, commercial: 0, units: 15 },
  { month: 'Nov', conventional: 2300000, fha_va: 980000, nonqm: 440000, commercial: 0, units: 13 },
  { month: 'Dec', conventional: 1800000, fha_va: 750000, nonqm: 290000, commercial: 820000, units: 10 },
  { month: 'Jan', conventional: 2100000, fha_va: 920000, nonqm: 380000, commercial: 0, units: 12 },
  { month: 'Feb', conventional: 2600000, fha_va: 1100000, nonqm: 450000, commercial: 0, units: 14 },
  { month: 'Mar', conventional: 3100000, fha_va: 1400000, nonqm: 520000, commercial: 0, units: 17 },
  { month: 'Apr', conventional: 3400000, fha_va: 1500000, nonqm: 610000, commercial: 1200000, units: 19 },
  { month: 'May', conventional: 3200000, fha_va: 1350000, nonqm: 580000, commercial: 0, units: 18 },
  { month: 'Jun', conventional: 2900000, fha_va: 1250000, nonqm: 490000, commercial: 0, units: 16 },
];

const SAMPLE_PULL_THROUGH = [
  { source: 'Referral', leads: 120, applications: 91, approvals: 72, closes: 58, revenue_per_lead: 3200 },
  { source: 'Realtor Partner', leads: 85, applications: 68, approvals: 52, closes: 44, revenue_per_lead: 2900 },
  { source: 'Google', leads: 210, applications: 126, approvals: 84, closes: 52, revenue_per_lead: 1100 },
  { source: 'Facebook', leads: 180, applications: 90, approvals: 54, closes: 29, revenue_per_lead: 820 },
  { source: 'Website', leads: 95, applications: 62, approvals: 44, closes: 36, revenue_per_lead: 1600 },
  { source: 'Zillow', leads: 140, applications: 70, approvals: 42, closes: 22, revenue_per_lead: 650 },
];

const SAMPLE_REFERRAL_ROI = [
  { name: 'Sarah Chen (Keller Williams)', leads: 28, closes: 22, volume: 6800000, last_referral: '3 days ago' },
  { name: 'Marcus Rodriguez (Exit Realty)', leads: 19, closes: 15, volume: 4200000, last_referral: '1 week ago' },
  { name: 'Jennifer Park (Coldwell Banker)', leads: 15, closes: 11, volume: 3500000, last_referral: '2 weeks ago' },
  { name: 'David Kim (RE/MAX)', leads: 12, closes: 8, volume: 2100000, last_referral: '1 month ago' },
  { name: 'Amy Torres (Century 21)', leads: 9, closes: 6, volume: 1800000, last_referral: '3 weeks ago' },
];

const DATE_RANGES = ['MTD', 'QTD', 'YTD', 'L12M'] as const;
type DateRange = typeof DATE_RANGES[number];

// ── Tooltip formatters ─────────────────────────────────────────────────
function volumeTooltipFormatter(value: number): [string, string] {
  return [formatCurrency(value, { compact: true }), ''];
}

// ── Pull-through color ──────────────────────────────────────────────────
function ptColor(rate: number): string {
  if (rate >= 40) return 'text-success';
  if (rate >= 25) return 'text-warning';
  return 'text-danger';
}

function ptBgColor(rate: number): string {
  if (rate >= 40) return 'bg-success/[0.08] text-success';
  if (rate >= 25) return 'bg-warning/[0.08] text-[#FF9500]';
  return 'bg-danger/[0.08] text-danger';
}

// ── Main component ─────────────────────────────────────────────────────
export default function RevenueClient({
  closedLoans,
  activeLeadsCount,
  avgHistoricalCloseRate,
  avgLoanSize,
  orgSettings,
}: RevenueProps) {
  const [dateRange, setDateRange] = useState<DateRange>('MTD');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const isSample = closedLoans.length === 0;

  const basisPoints = orgSettings?.basis_points ?? 100;
  const monthlyGoal = orgSettings?.monthly_goal ?? 3000000;

  // Compute KPIs from real data or show zeroes
  const kpis = useMemo(() => {
    if (isSample) {
      return {
        totalVolume: 0,
        totalUnits: 0,
        avgLoanSize: 0,
        estimatedRevenue: 0,
        pipelineValue: activeLeadsCount * avgLoanSize * avgHistoricalCloseRate,
        weightedPipeline: activeLeadsCount * avgLoanSize * 0.5,
        priorPeriodVolume: 0,
        priorPeriodUnits: 0,
      };
    }

    const now = new Date();
    let startDate: Date;
    let priorStart: Date;
    let priorEnd: Date;

    if (dateRange === 'MTD') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      priorStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      priorEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (dateRange === 'QTD') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), qMonth, 1);
      priorStart = new Date(now.getFullYear(), qMonth - 3, 1);
      priorEnd = new Date(now.getFullYear(), qMonth, 0);
    } else if (dateRange === 'YTD') {
      startDate = new Date(now.getFullYear(), 0, 1);
      priorStart = new Date(now.getFullYear() - 1, 0, 1);
      priorEnd = new Date(now.getFullYear() - 1, 11, 31);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      priorStart = new Date(now.getFullYear(), now.getMonth() - 23, 1);
      priorEnd = new Date(now.getFullYear(), now.getMonth() - 12, 0);
    }

    const inRange = closedLoans.filter((l) => {
      const d = new Date(l.close_date);
      return d >= startDate && d <= now;
    });
    const priorRange = closedLoans.filter((l) => {
      const d = new Date(l.close_date);
      return d >= priorStart && d <= priorEnd;
    });

    const totalVolume = inRange.reduce((s, l) => s + l.loan_amount, 0);
    const priorVolume = priorRange.reduce((s, l) => s + l.loan_amount, 0);

    return {
      totalVolume,
      totalUnits: inRange.length,
      avgLoanSize: inRange.length > 0 ? totalVolume / inRange.length : 0,
      estimatedRevenue: (totalVolume * basisPoints) / 10000,
      pipelineValue: activeLeadsCount * avgLoanSize * avgHistoricalCloseRate,
      weightedPipeline: activeLeadsCount * avgLoanSize * 0.5,
      priorPeriodVolume: priorVolume,
      priorPeriodUnits: priorRange.length,
    };
  }, [closedLoans, dateRange, isSample, basisPoints, activeLeadsCount, avgLoanSize, avgHistoricalCloseRate]);

  const volumeChange =
    kpis.priorPeriodVolume > 0
      ? ((kpis.totalVolume - kpis.priorPeriodVolume) / kpis.priorPeriodVolume) * 100
      : null;

  const pipelineGap = Math.max(0, monthlyGoal - kpis.pipelineValue);

  async function fetchAiSummary() {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/market-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentRates: {
            thirtyYrFixed: 6.875,
            fifteenYrFixed: 6.25,
            fiveOneArm: 6.125,
            fha: 6.5,
            va: 6.25,
          },
          pipelineStats: {
            activeLeads: activeLeadsCount,
            pipelineValue: kpis.pipelineValue,
          },
          closedVolumeMTD: kpis.totalVolume,
        }),
      });
      const json = await res.json() as { content?: string };
      setAiSummary(json.content ?? null);
    } catch {
      setAiSummary('Unable to load AI summary. Please try again.');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-navy tracking-tight">Revenue Intelligence</h1>
          <p className="text-sm text-label2 mt-0.5">
            {isSample
              ? 'Sample data — your data will appear here after adding loans'
              : `${closedLoans.length} closed loans · ${basisPoints}bps avg compensation`}
          </p>
        </div>
        {/* Date range selector */}
        <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1 flex-shrink-0">
          {DATE_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={cn(
                'px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all',
                dateRange === r
                  ? 'bg-white text-label shadow-sm'
                  : 'text-label2 hover:text-label'
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Sample data banner */}
      {isSample && (
        <div className="flex items-start gap-3 bg-gold/[0.06] border border-gold/[0.2] rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-xs text-label2">
            <span className="font-semibold text-label">Sample data shown.</span> Charts and tables below use illustrative data. Your real data will populate automatically after you add closed loans and commission records.
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Volume Closed"
          value={isSample ? formatCurrency(28400000) : formatCurrency(kpis.totalVolume)}
          sub={
            isSample
              ? 'Sample data'
              : volumeChange !== null
                ? `${volumeChange >= 0 ? '+' : ''}${volumeChange.toFixed(1)}% vs prior period`
                : 'No prior period data'
          }
          subColor={volumeChange !== null ? (volumeChange >= 0 ? 'text-success' : 'text-danger') : 'text-label3'}
          icon={<DollarSign className="w-4 h-4 text-blue" />}
          trend={volumeChange}
        />
        <KpiCard
          label="Units Closed"
          value={isSample ? '167' : kpis.totalUnits.toString()}
          sub={isSample ? 'Sample data' : `${dateRange} period`}
          subColor="text-label3"
          icon={<BarChart2 className="w-4 h-4 text-blue" />}
        />
        <KpiCard
          label="Avg Loan Size"
          value={isSample ? formatCurrency(170059) : formatCurrency(kpis.avgLoanSize)}
          sub="Per closed loan"
          subColor="text-label3"
          icon={<TrendingUp className="w-4 h-4 text-blue" />}
        />
        <KpiCard
          label={`Est. Revenue (${basisPoints}bps)`}
          value={isSample ? formatCurrency(284000) : formatCurrency(kpis.estimatedRevenue)}
          sub="Gross broker comp"
          subColor="text-label3"
          icon={<Percent className="w-4 h-4 text-gold" />}
        />
        <KpiCard
          label="Pipeline Value"
          value={isSample ? formatCurrency(12400000) : formatCurrency(kpis.pipelineValue)}
          sub={`${activeLeadsCount} active leads × ${(avgHistoricalCloseRate * 100).toFixed(0)}% historical close rate`}
          subColor="text-label3"
          icon={<Target className="w-4 h-4 text-gold" />}
        />
        <KpiCard
          label="Weighted Pipeline"
          value={isSample ? formatCurrency(5200000) : formatCurrency(kpis.weightedPipeline)}
          sub="Stage-probability adjusted"
          subColor="text-label3"
          icon={<TrendingUp className="w-4 h-4 text-success" />}
        />
      </div>

      {/* AI Market Summary */}
      <div className="bg-navy rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            <h3 className="text-sm font-semibold text-white">AI Market Intelligence</h3>
          </div>
          <button
            onClick={fetchAiSummary}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.1] text-white text-xs font-medium hover:bg-white/[0.15] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn('w-3 h-3', aiLoading && 'animate-spin')} />
            {aiLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {aiSummary ? (
          <p className="text-sm text-white/90 leading-relaxed">{aiSummary}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-white/50 mb-3">Live rates snapshot (mock — configure rate feed API)</p>
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: '30yr Fixed', rate: '6.875%' },
                { label: '15yr Fixed', rate: '6.250%' },
                { label: '5/1 ARM', rate: '6.125%' },
                { label: 'FHA 30yr', rate: '6.500%' },
                { label: 'VA 30yr', rate: '6.250%' },
              ].map((r) => (
                <div key={r.label} className="bg-white/[0.06] rounded-xl p-3 text-center">
                  <p className="text-[18px] font-mono font-semibold text-gold">{r.rate}</p>
                  <p className="text-[10px] text-white/60 mt-0.5">{r.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/40 mt-2">Click &quot;Refresh&quot; to get an AI-generated market summary based on your pipeline data.</p>
          </div>
        )}
      </div>

      {/* Volume waterfall chart */}
      <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-navy">Volume by Loan Type — Last 12 Months</h3>
            {isSample && <p className="text-xs text-label3 mt-0.5">Sample data — your data will appear here after adding loans</p>}
          </div>
        </div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={SAMPLE_MONTHS} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#AEAEB2' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="volume"
                tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`}
                tick={{ fontSize: 11, fill: '#AEAEB2' }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <YAxis
                yAxisId="units"
                orientation="right"
                tick={{ fontSize: 11, fill: '#AEAEB2' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                formatter={volumeTooltipFormatter}
                contentStyle={{
                  background: '#fff',
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#6C6C70', paddingTop: 12 }}
              />
              <Bar yAxisId="volume" dataKey="conventional" name="Conventional" stackId="a" fill="#007AFF" radius={[0, 0, 0, 0]} />
              <Bar yAxisId="volume" dataKey="fha_va" name="FHA/VA/USDA" stackId="a" fill="#34C759" radius={[0, 0, 0, 0]} />
              <Bar yAxisId="volume" dataKey="nonqm" name="Non-QM/DSCR" stackId="a" fill="#C9A95C" radius={[0, 0, 0, 0]} />
              <Bar yAxisId="volume" dataKey="commercial" name="Commercial" stackId="a" fill="#AF52DE" radius={[4, 4, 0, 0]} />
              <Line yAxisId="units" type="monotone" dataKey="units" name="Units" stroke="#0F1D2E" strokeWidth={2} dot={{ fill: '#0F1D2E', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline goal + forecast */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-navy mb-1">Monthly Goal Tracker</h3>
          <p className="text-xs text-label3 mb-4">Goal: {formatCurrency(monthlyGoal)} volume/month</p>
          <div className="space-y-3">
            {[
              { label: 'Conservative', pct: 65, value: monthlyGoal * 0.65 },
              { label: 'Base Case', pct: 85, value: monthlyGoal * 0.85 },
              { label: 'Best Case', pct: 105, value: monthlyGoal * 1.05 },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-label">{s.label}</span>
                  <span className="text-xs font-mono font-semibold text-navy">{formatCurrency(s.value, { compact: true })}</span>
                </div>
                <div className="h-2 bg-black/[0.04] rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', s.pct >= 100 ? 'bg-success' : s.pct >= 80 ? 'bg-blue' : 'bg-warning')}
                    style={{ width: `${Math.min(100, s.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {pipelineGap > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-warning/[0.06] border border-warning/20">
              <p className="text-xs font-medium text-[#FF9500]">
                Pipeline gap: {formatCurrency(pipelineGap, { compact: true })} needed to hit goal
              </p>
            </div>
          )}
        </div>

        <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-navy mb-1">Weighted Pipeline by Stage</h3>
          <p className="text-xs text-label3 mb-4">Stage-adjusted probability of close</p>
          <div className="space-y-2.5">
            {Object.entries(STAGE_WEIGHTS).map(([stage, weight]) => {
              const label = stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-xs text-label2 capitalize">{label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
                      <div className="h-full bg-blue rounded-full" style={{ width: `${weight * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono font-semibold text-navy w-8 text-right">{Math.round(weight * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pull-through analysis */}
      <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06]">
          <h3 className="text-sm font-semibold text-navy">Pull-Through Analysis by Lead Source</h3>
          {isSample && <p className="text-xs text-label3 mt-0.5">Sample data — your data will appear here after adding loans</p>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.02] border-b border-black/[0.04]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Source</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Leads</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">App Rate</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Approval Rate</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Close Rate</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Rev / Lead</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {SAMPLE_PULL_THROUGH.map((row) => {
                const appRate = Math.round((row.applications / row.leads) * 100);
                const approvalRate = Math.round((row.approvals / row.leads) * 100);
                const closeRate = Math.round((row.closes / row.leads) * 100);
                return (
                  <tr key={row.source} className="hover:bg-black/[0.01] transition-colors">
                    <td className="px-5 py-3.5 font-medium text-navy">{row.source}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-label">{row.leads}</td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn('text-[12px] font-mono font-semibold', ptColor(appRate))}>{appRate}%</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn('text-[12px] font-mono font-semibold', ptColor(approvalRate))}>{approvalRate}%</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono', ptBgColor(closeRate))}>
                        {closeRate}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-navy">{formatCurrency(row.revenue_per_lead)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Referral partner ROI */}
      <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06]">
          <h3 className="text-sm font-semibold text-navy">Referral Partner ROI</h3>
          {isSample && <p className="text-xs text-label3 mt-0.5">Sample data</p>}
        </div>
        {/* Best partner highlight */}
        <div className="px-5 py-3.5 bg-success/[0.04] border-b border-black/[0.04] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-success uppercase tracking-wide">Top Partner</span>
            <p className="text-sm font-medium text-navy mt-0.5">{SAMPLE_REFERRAL_ROI[0].name}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-navy font-mono">{formatCurrency(SAMPLE_REFERRAL_ROI[0].volume, { compact: true })}</p>
            <p className="text-xs text-label3">{SAMPLE_REFERRAL_ROI[0].closes} closes · last {SAMPLE_REFERRAL_ROI[0].last_referral}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.02] border-b border-black/[0.04]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Partner</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Leads</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Closes</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Total Volume</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Last Referral</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {SAMPLE_REFERRAL_ROI.map((p) => (
                <tr key={p.name} className="hover:bg-black/[0.01] transition-colors">
                  <td className="px-5 py-3.5 font-medium text-navy">{p.name}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-label">{p.leads}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-label">{p.closes}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-semibold text-navy">{formatCurrency(p.volume, { compact: true })}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-label2">{p.last_referral}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  subColor: string;
  icon: React.ReactNode;
  trend?: number | null;
}

function KpiCard({ label, value, sub, subColor, icon, trend }: KpiCardProps) {
  return (
    <div className="bg-white border border-black/[0.06] rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-label2 uppercase tracking-wide">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-black/[0.04] flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-[24px] font-semibold text-navy tracking-tight font-mono leading-none">{value}</p>
      <div className="flex items-center gap-1 mt-1.5">
        {trend !== null && trend !== undefined && (
          trend >= 0
            ? <ArrowUpRight className="w-3 h-3 text-success flex-shrink-0" />
            : <ArrowDownRight className="w-3 h-3 text-danger flex-shrink-0" />
        )}
        <p className={cn('text-xs', subColor)}>{sub}</p>
      </div>
    </div>
  );
}
