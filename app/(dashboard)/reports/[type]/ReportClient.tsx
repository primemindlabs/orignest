'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import type { ReportType } from '@/lib/reports';

const TITLES: Record<ReportType, string> = {
  production: 'Production Report',
  pl: 'P&L Report',
  hmda: 'HMDA Pre-Report',
  velocity: 'Pipeline Velocity',
  compliance: 'Compliance Report',
  referral: 'Referral Source Report',
  scorecard: 'LO Scorecard',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
}
function startDefault(): string { return new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function endDefault(): string { return new Date().toISOString().slice(0, 10); }

export function ReportClient({ type }: { type: ReportType }) {
  const [start, setStart] = useState(startDefault());
  const [end, setEnd] = useState(endDefault());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const res = await fetch(`/api/reports/${type}?start=${start}&end=${end}`);
    if (res.ok) { const j = await res.json(); setData(j.data); }
    else { const j = await res.json().catch(() => ({})); setError(j.error ?? 'Failed to load report'); setData(null); }
    setLoading(false);
  }, [type, start, end]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5 max-w-4xl">
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-label-2 hover:text-label"><ArrowLeft size={15} /> All Reports</Link>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[22px] font-bold text-label tracking-tight">{TITLES[type]}</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="px-2.5 py-1.5 rounded-[8px] border border-border bg-white text-sm" />
          <span className="text-label-3 text-sm">→</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="px-2.5 py-1.5 rounded-[8px] border border-border bg-white text-sm" />
          <a href={`/api/reports/${type}/export?start=${start}&end=${end}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue text-white text-sm font-semibold rounded-[8px] hover:bg-blue/90"><Download size={14} /> CSV</a>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 size={22} className="text-blue mx-auto animate-spin" /></div>
      ) : error ? (
        <div className="bg-red/10 border border-red/20 rounded-xl px-4 py-3 text-sm text-red">{error}</div>
      ) : !data ? null : (
        <ReportBody type={type} data={data} />
      )}
    </div>
  );
}

function StatGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5">
          <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-[20px] font-bold text-label leading-tight">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card overflow-x-auto">
      <table className="w-full">
        <thead><tr className="border-b border-black/[0.06] bg-bg">{headers.map((h) => <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-label-3 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-black/[0.04]">
          {rows.length === 0 ? <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-sm text-label-3">No data in this period.</td></tr> :
            rows.map((r, i) => <tr key={i} className="hover:bg-bg">{r.map((c, j) => <td key={j} className="px-4 py-3 text-sm text-label">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function ReportBody({ type, data }: { type: ReportType; data: any }) {
  if (type === 'production') {
    return (
      <div className="space-y-4">
        <StatGrid items={[['Total Volume', fmt(data.totals.volume)], ['Units', String(data.totals.units)], ['Avg Loan', fmt(data.totals.avgLoanSize)], ['Purchase / Refi', `${data.totals.purchaseUnits} / ${data.totals.refiUnits}`]]} />
        <h2 className="text-sm font-semibold text-label">By Loan Officer</h2>
        <Table headers={['Loan Officer', 'Units', 'Volume']} rows={(data.byLo ?? []).map((r: any) => [r.name, r.units, fmt(r.volume)])} />
        <h2 className="text-sm font-semibold text-label">By Loan Type</h2>
        <Table headers={['Type', 'Units', 'Volume']} rows={(data.byType ?? []).map((r: any) => [r.loan_type, r.units, fmt(r.volume)])} />
      </div>
    );
  }
  if (type === 'velocity') {
    return <StatGrid items={[['Loans in Sample', String(data.sample)], ['Avg Days to Close', String(data.avgDaysToClose)], ['Median Days', String(data.medianDaysToClose)], ['Lead→App / App→Close', `${data.avgDaysLeadToApp} / ${data.avgDaysAppToClose}`]]} />;
  }
  if (type === 'referral') {
    return <Table headers={['Source', 'Leads', 'Closed', 'Volume', 'Conv %']} rows={(data.rows ?? []).map((r: any) => [r.source, r.received, r.closed, fmt(r.volume), `${r.conversionRate}%`])} />;
  }
  if (type === 'scorecard') {
    return <Table headers={['Loan Officer', 'Apps', 'Closed', 'Close %', 'Avg Days', 'Resp (min)', 'Open Conditions']} rows={(data.rows ?? []).map((r: any) => [r.lo_name, r.appsReceived, r.loansClosed, `${r.closingRate}%`, r.avgDaysToClose, r.avgResponseMinutes ?? '—', r.outstandingConditions])} />;
  }
  if (type === 'compliance') {
    return (
      <div className="space-y-4">
        <StatGrid items={[['Total Flags', String(data.flagCount)], ['High Severity', String(data.highSeverity)], ['Medium', String(data.mediumSeverity)], ['Status', data.flagCount === 0 ? 'Clear' : 'Review']]} />
        <Table headers={['Severity', 'Type', 'Description']} rows={(data.flags ?? []).map((f: any) => [f.severity, f.type, f.description])} />
        {data.notes?.map((n: string) => <p key={n} className="text-xs text-label-3">{n}</p>)}
      </div>
    );
  }
  if (type === 'pl') {
    if (!data.available) return <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-6 text-sm text-label-2">{data.note}</div>;
    return <StatGrid items={[['Gross Revenue', fmt(data.totals.grossRevenue)], ['LO Compensation', fmt(data.totals.totalLoComp)], ['Branch Profit', fmt(data.totals.branchProfit)], ['Margin %', `${data.totals.marginPct}%`]]} />;
  }
  if (type === 'hmda') {
    if (!data.available) return <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-6 text-sm text-label-2">{data.note}</div>;
    return (
      <div className="space-y-4">
        <StatGrid items={[['Applications', String(data.total)], ['HMDA Issues', String(data.hmdaIssues.length)], ['Ready to File', data.readyForFiling ? 'Yes' : 'No'], ['Period', '']]} />
        <Table headers={['Issue']} rows={(data.hmdaIssues ?? []).map((i: string) => [i])} />
      </div>
    );
  }
  return null;
}
