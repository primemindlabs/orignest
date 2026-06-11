'use client';

import { useMemo, useState } from 'react';
import { DateRangePicker } from './DateRangePicker';
import { DownloadMenu } from './DownloadMenu';
import { MoneyBar, MetricTile, VolumeTrendChart, StageFunnel } from './charts';
import { RecentFundedTable, PipelineTable, PartnerTable, TeamTable } from './tables';
import { exportToCSV, exportToPDF } from '@/lib/reports/export';
import {
  presetRange, priorRange, pipelineByStage, overviewMetrics, pctDelta, monthlyVolume,
  stageFunnel, recentFunded, pipelineRows, slowestStage, partnerPerformance, teamPerformance,
  fmtDollars, type RangePreset, type RLead, type RRealtor, type RProfile,
} from '@/lib/reports/compute';

type Tab = 'overview' | 'pipeline' | 'partners' | 'team';
const PRINT_CSS = `@media print {
  .no-print { display: none !important; }
  body * { visibility: hidden; }
  #report-print-area, #report-print-area * { visibility: visible; }
  #report-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
}`;

export function ReportsClient({
  role, compRate, nowISO, leads, realtors, team,
}: {
  role: string; compRate: number; nowISO: string; leads: RLead[]; realtors: RRealtor[]; team: RProfile[];
}) {
  const isManager = ['branch_manager', 'admin', 'manager'].includes(role);
  const [tab, setTab] = useState<Tab>('overview');
  const [preset, setPreset] = useState<RangePreset>('this_month');

  const now = useMemo(() => new Date(nowISO), [nowISO]);
  const realtorById = useMemo(() => new Map(realtors.map((r) => [r.id, r])), [realtors]);

  const d = useMemo(() => {
    const range = presetRange(preset, now);
    const prior = priorRange(range);
    const cur = overviewMetrics(leads, range);
    const pri = overviewMetrics(leads, prior);
    return {
      range,
      moneyBar: pipelineByStage(leads),
      cur, pri,
      monthly: monthlyVolume(leads, now),
      funnel: stageFunnel(leads, range),
      funded: recentFunded(leads, realtorById, range, compRate),
      pipeline: pipelineRows(leads, realtorById, compRate, now),
      slowest: slowestStage(leads, now),
      partners: partnerPerformance(leads, realtors, range),
      team: isManager ? teamPerformance(leads, team, range) : [],
    };
  }, [preset, now, leads, realtors, realtorById, team, compRate, isManager]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'partners', label: 'Partners' },
    ...(isManager ? [{ key: 'team' as Tab, label: 'Team' }] : []),
  ];

  function handleCsv() {
    const name = `reports-${tab}-${preset}`;
    if (tab === 'overview') {
      exportToCSV(d.funded.map((l) => ({
        borrower: l.borrower, loan_amount: Math.round(l.loan_amount), loan_type: l.loan_type,
        realtor: l.realtor, funded: l.funded ?? '', days_to_close: l.days_to_close ?? '', commission: Math.round(l.commission),
      })), name);
    } else if (tab === 'pipeline') {
      exportToCSV(d.pipeline.map((r) => ({
        borrower: r.borrower, loan_amount: Math.round(r.loan_amount), stage: r.stage_label,
        stage_age_days: r.stage_age ?? '', realtor: r.realtor, loan_type: r.loan_type, source: r.source,
        est_close: r.est_close ?? '', commission: Math.round(r.commission),
      })), name);
    } else if (tab === 'partners') {
      exportToCSV(d.partners.map((p) => ({
        realtor: p.name, brokerage: p.brokerage, referrals: p.referrals, funded: p.funded_count,
        pipeline_volume: Math.round(p.pipeline_volume), funded_volume: Math.round(p.funded_volume),
        pull_through_pct: p.pull_through != null ? Math.round(p.pull_through) : '', avg_loan_size: Math.round(p.avg_loan_size),
      })), name);
    } else {
      exportToCSV(d.team.map((t) => ({
        lo: t.name, funded_volume: Math.round(t.funded_volume), loans: t.funded_count,
        pull_through_pct: t.pull_through != null ? Math.round(t.pull_through) : '',
        avg_days: t.avg_days ?? '', goal_pct: t.goal_pct != null ? Math.round(t.goal_pct) : 'not set',
      })), name);
    }
  }
  const handlePdf = () => exportToPDF(`AshleyIQ Report — ${tab}`);

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-bold text-black tracking-tight">Reports</h1>
        <DateRangePicker value={preset} onChange={setPreset} />
      </div>

      {/* Tabs + download */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-0 overflow-x-auto no-print">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.key ? 'text-[#8A6310]' : 'border-transparent text-label-2 hover:text-black'}`}
              style={tab === t.key ? { borderColor: '#C9A95C' } : { borderColor: 'transparent' }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pb-1.5">
          <DownloadMenu onCsv={handleCsv} onPdf={handlePdf} />
        </div>
      </div>

      <div id="report-print-area" className="space-y-4">
        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            <MoneyBar stages={d.moneyBar} />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MetricTile label="Funded volume" value={fmtDollars(d.cur.fundedVolume)} delta={pctDelta(d.cur.fundedVolume, d.pri.fundedVolume)} deltaLabel="vs prior" />
              <MetricTile label="Loans funded" value={String(d.cur.fundedCount)} delta={pctDelta(d.cur.fundedCount, d.pri.fundedCount)} deltaLabel="vs prior" />
              <MetricTile label="Avg loan size" value={fmtDollars(d.cur.avgLoanSize)} delta={pctDelta(d.cur.avgLoanSize, d.pri.avgLoanSize)} deltaLabel="vs prior" />
              <MetricTile label="Pull-through" value={d.cur.pullThrough != null ? `${Math.round(d.cur.pullThrough)}%` : '—'} delta={d.cur.pullThrough != null && d.pri.pullThrough != null ? pctDelta(d.cur.pullThrough, d.pri.pullThrough) : null} deltaLabel="vs prior" />
              <MetricTile label="Avg days to close" value={d.cur.avgDaysToClose != null ? `${d.cur.avgDaysToClose}d` : '—'} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <VolumeTrendChart data={d.monthly} />
              <StageFunnel rows={d.funnel} />
            </div>
            <RecentFundedTable loans={d.funded} />
          </>
        )}

        {/* PIPELINE */}
        {tab === 'pipeline' && <PipelineTable rows={d.pipeline} slowest={d.slowest} />}

        {/* PARTNERS */}
        {tab === 'partners' && <PartnerTable rows={d.partners} />}

        {/* TEAM */}
        {tab === 'team' && isManager && <TeamTable rows={d.team} />}
      </div>
    </div>
  );
}
