'use client';

/**
 * Phase 149 — Mortgage Call Report (RMLA) worksheet viewer + CSV export.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Download } from 'lucide-react';

interface Cell { received: number; received_amount: number; closed: number; closed_amount: number; denied: number; withdrawn: number; in_process: number }
interface Row extends Cell { key: string }
interface Report { year: number; quarter: number; period: { start: string; end: string }; totals: Cell; byState: Row[]; byLoanType: Row[]; note: string }

const money = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const NOW = new Date();

export function McrClient() {
  const [year, setYear] = useState(NOW.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(NOW.getMonth() / 3) + 1);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const r = await fetch(`/api/reports/mcr?year=${year}&quarter=${quarter}`);
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { setError(j.error ?? 'Could not load report.'); setReport(null); return; }
    setReport(j.report);
  }, [year, quarter]);
  useEffect(() => { load(); }, [load]);

  const sel = 'h-9 px-2.5 rounded-btn border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] outline-none';
  const years = [NOW.getFullYear(), NOW.getFullYear() - 1, NOW.getFullYear() - 2];

  const Table = ({ title, rows }: { title: string; rows: Row[] }) => (
    <div className="border border-[var(--c-border)] rounded-[14px] overflow-hidden">
      <div className="px-4 py-2.5 text-[13px] font-semibold text-[var(--c-text)] border-b border-[var(--c-border)]">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead><tr className="text-[var(--c-label2)] text-left">
            {['', 'Apps recd', 'Apps $', 'Closed', 'Closed $', 'Denied', 'Withdrawn', 'In process'].map((h, i) => <th key={i} className={`px-3 py-2 font-medium ${i === 0 ? '' : 'text-right'}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-center text-[var(--c-label2)]">No activity in this period.</td></tr>}
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--c-border)]">
                <td className="px-3 py-2 text-[var(--c-text)]">{r.key}</td>
                <td className="px-3 py-2 text-right">{r.received}</td>
                <td className="px-3 py-2 text-right">{money(r.received_amount)}</td>
                <td className="px-3 py-2 text-right">{r.closed}</td>
                <td className="px-3 py-2 text-right">{money(r.closed_amount)}</td>
                <td className="px-3 py-2 text-right">{r.denied}</td>
                <td className="px-3 py-2 text-right">{r.withdrawn}</td>
                <td className="px-3 py-2 text-right">{r.in_process}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={sel}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className={sel}>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select>
        <a href={`/api/reports/mcr?year=${year}&quarter=${quarter}&format=csv`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]"><Download size={14} /> Export CSV</a>
      </div>

      {loading ? <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)] py-6"><Loader2 size={14} className="animate-spin" /> Loading…</div>
        : error ? <div className="text-[13px] text-rose-600">{error}</div>
        : report ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['Apps received', report.totals.received], ['Loans closed', report.totals.closed], ['Denied', report.totals.denied], ['In process', report.totals.in_process]].map(([l, v]) => (
                <div key={l as string} className="border border-[var(--c-border)] rounded-[14px] p-3.5"><div className="text-[12px] text-[var(--c-label2)]">{l}</div><div className="text-[22px] font-bold text-[var(--c-text)]">{v as number}</div></div>
              ))}
            </div>
            <div className="text-[12px] text-[var(--c-label2)]">Closed volume this quarter: <span className="font-semibold text-[var(--c-text)]">{money(report.totals.closed_amount)}</span> · period {report.period.start} to {report.period.end}</div>
            <Table title="By state" rows={report.byState} />
            <Table title="By loan type" rows={report.byLoanType} />
            <p className="text-[11px] text-[var(--c-label2)]">{report.note}</p>
          </>
        ) : null}
    </div>
  );
}
