'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconTrendingDown, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { fmtDollars, type FundedRow, type PipelineRow, type PartnerRow, type TeamRow } from '@/lib/reports/compute';

const card = 'bg-surface rounded-card shadow-card border border-border overflow-hidden';
const th = 'text-left text-[11px] font-medium uppercase tracking-wide text-label-2 px-4 py-2.5';
const td = 'px-4 py-3 text-sm text-black align-middle';
const mono: React.CSSProperties = { fontFamily: "'DM Mono', monospace" };

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <span className="text-[14px] font-semibold text-black">{title}</span>
      {sub && <span className="text-xs text-label-2">{sub}</span>}
    </div>
  );
}

// ── Recent funded ─────────────────────────────────────────────────────────────
export function RecentFundedTable({ loans }: { loans: FundedRow[] }) {
  return (
    <div className={card}>
      <SectionHeader title="Recent funded loans" sub={`${loans.length} this period`} />
      {loans.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-label-2">No funded loans in this period.</p>
      ) : (
        <table className="w-full">
          <thead><tr className="border-b border-border">
            <th className={th}>Borrower</th><th className={th}>Loan amount</th><th className={th}>Type</th>
            <th className={th}>Realtor</th><th className={th}>Funded</th><th className={th}>Days</th><th className={th}>Commission</th>
          </tr></thead>
          <tbody>
            {loans.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className={td}><Link href={`/leads/${l.id}`} className="text-[#8A6310] hover:underline">{l.borrower}</Link></td>
                <td className={td} style={mono}>{fmtDollars(l.loan_amount)}</td>
                <td className={td}>{l.loan_type}</td>
                <td className={td}>{l.realtor}</td>
                <td className={td}>{l.funded ?? '—'}</td>
                <td className={td}>{l.days_to_close != null ? `${l.days_to_close}d` : '—'}</td>
                <td className={td} style={{ ...mono, color: '#8A6310' }}>{fmtDollars(l.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Pipeline (filters + velocity) ─────────────────────────────────────────────
function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 px-2.5 rounded-btn text-sm bg-surface border border-border text-black no-print">
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function PipelineTable({ rows, slowest }: { rows: PipelineRow[]; slowest: { label: string; avgDays: number } | null }) {
  const [stage, setStage] = useState('');
  const [realtor, setRealtor] = useState('');
  const [loanType, setLoanType] = useState('');
  const [source, setSource] = useState('');

  const opts = useMemo(() => ({
    stage: Array.from(new Set(rows.map((r) => r.stage_label))).sort(),
    realtor: Array.from(new Set(rows.map((r) => r.realtor).filter((x) => x !== '—'))).sort(),
    loanType: Array.from(new Set(rows.map((r) => r.loan_type).filter((x) => x !== '—'))).sort(),
    source: Array.from(new Set(rows.map((r) => r.source).filter((x) => x !== '—'))).sort(),
  }), [rows]);

  const filtered = rows.filter((r) =>
    (!stage || r.stage_label === stage) && (!realtor || r.realtor === realtor) &&
    (!loanType || r.loan_type === loanType) && (!source || r.source === source));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={stage} onChange={setStage} options={opts.stage} label="All stages" />
        <Select value={realtor} onChange={setRealtor} options={opts.realtor} label="All realtors" />
        <Select value={loanType} onChange={setLoanType} options={opts.loanType} label="All loan types" />
        <Select value={source} onChange={setSource} options={opts.source} label="All sources" />
      </div>

      {slowest && (
        <div className="flex items-center gap-1.5 text-xs text-label-2 px-1">
          <IconTrendingDown size={13} className="text-[#C4724A]" />
          Avg {slowest.avgDays}d in {slowest.label} —
          {slowest.avgDays > 10 ? ' longest stage this period. Consider follow-up cadence.' : ' within normal range.'}
        </div>
      )}

      <div className={card}>
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-label-2">No loans match these filters.</p>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className={th}>Borrower</th><th className={th}>Loan amt</th><th className={th}>Stage</th>
              <th className={th}>Stage age</th><th className={th}>Realtor</th><th className={th}>Est. close</th><th className={th}>Commission</th>
            </tr></thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className={td}><Link href={`/leads/${r.id}`} className="text-[#8A6310] hover:underline">{r.borrower}</Link></td>
                  <td className={td} style={mono}>{fmtDollars(r.loan_amount)}</td>
                  <td className={td}>{r.stage_label}</td>
                  <td className={td}>
                    {r.stage_age == null ? '—' : r.stage_age > 7 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ background: '#fdf0ea', color: '#b85c20' }}>{r.stage_age}d</span>
                    ) : `${r.stage_age}d`}
                  </td>
                  <td className={td}>{r.realtor}</td>
                  <td className={td}>
                    {r.est_close ? (
                      r.est_close_soon ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium" style={{ background: '#fdf8ee', color: '#8A6310' }}>{r.est_close}</span> : r.est_close
                    ) : '—'}
                  </td>
                  <td className={td} style={{ ...mono, color: '#8A6310' }}>{fmtDollars(r.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Partners ──────────────────────────────────────────────────────────────────
function PullThroughCell({ pct }: { pct: number | null }) {
  if (pct == null) return <span style={{ ...mono, color: '#86868B' }}>—</span>;
  return (
    <div>
      <span style={mono}>{pct.toFixed(0)}%</span>
      <div style={{ height: 3, background: '#E5E7EB', borderRadius: 2, marginTop: 3, width: 60 }}>
        <div style={{ height: 3, width: `${Math.min(pct, 100)}%`, background: '#C9A95C', borderRadius: 2 }} />
      </div>
    </div>
  );
}

export function PartnerTable({ rows }: { rows: PartnerRow[] }) {
  type Key = 'referrals' | 'pipeline_volume' | 'funded_volume' | 'pull_through' | 'avg_loan_size';
  const [sortKey, setSortKey] = useState<Key>('funded_volume');
  const sorted = [...rows].sort((a, b) => (Number(b[sortKey] ?? 0)) - (Number(a[sortKey] ?? 0)));
  const top3 = [...rows].sort((a, b) => b.funded_volume - a.funded_volume).slice(0, 3);
  const head = (label: string, key: Key) => (
    <th className={`${th} cursor-pointer select-none ${sortKey === key ? 'text-[#8A6310]' : ''}`} onClick={() => setSortKey(key)}>{label}</th>
  );

  return (
    <div className="space-y-3">
      <div className={card}>
        <SectionHeader title="Partner performance" sub={`${rows.length} partners`} />
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-label-2">No partner activity in this period.</p>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-border">
              <th className={th}>Realtor</th>{head('Referrals', 'referrals')}{head('Pipeline vol', 'pipeline_volume')}
              {head('Funded vol', 'funded_volume')}{head('Pull-through', 'pull_through')}{head('Avg loan', 'avg_loan_size')}
            </tr></thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className={td}>
                    <Link href={`/realtors/${r.id}`} className="text-[#8A6310] hover:underline">{r.name}</Link>
                    <div className="text-xs text-label-3">{r.brokerage}</div>
                  </td>
                  <td className={td} style={mono}>{r.referrals}</td>
                  <td className={td} style={mono}>{fmtDollars(r.pipeline_volume)}</td>
                  <td className={td} style={mono}>{fmtDollars(r.funded_volume)}</td>
                  <td className={td}><PullThroughCell pct={r.pull_through} /></td>
                  <td className={td} style={mono}>{fmtDollars(r.avg_loan_size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {top3.length > 0 && (
        <div className={`${card} p-4`}>
          <div className="text-[13px] font-semibold text-black mb-3">Top partners this period</div>
          <div className="grid grid-cols-3 gap-3">
            {top3.map((r, i) => (
              <div key={r.id} className="text-center p-3 rounded-[10px]" style={{ background: i === 0 ? '#fdf8ee' : '#f7f7f5', border: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div className="mx-auto w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: i === 0 ? '#C9A95C' : i === 1 ? '#A88440' : '#7A5C10' }}>{i + 1}</div>
                <div className="text-sm font-medium text-black mt-2 truncate">{r.name}</div>
                <div className="text-[13px] text-[#8A6310]" style={mono}>{fmtDollars(r.funded_volume)}</div>
                <div className="text-xs text-label-3">{r.funded_count} loans</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Team (BM) ─────────────────────────────────────────────────────────────────
export function TeamTable({ rows }: { rows: TeamRow[] }) {
  return (
    <div className={card}>
      <SectionHeader title="Team performance" sub={`${rows.length} loan officers`} />
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-label-2">No loan officers found.</p>
      ) : (
        <table className="w-full">
          <thead><tr className="border-b border-border">
            <th className={th}>LO</th><th className={th}>Volume</th><th className={th}>Loans</th>
            <th className={th}>Pull-through</th><th className={th}>Avg days</th><th className={th}>Goal %</th>
          </tr></thead>
          <tbody>
            {rows.map((lo) => (
              <tr key={lo.id} className="border-b border-border last:border-0">
                <td className={td}>{lo.name}</td>
                <td className={td} style={mono}>{fmtDollars(lo.funded_volume)}</td>
                <td className={td} style={mono}>{lo.funded_count}</td>
                <td className={td} style={mono}>{lo.pull_through != null ? `${lo.pull_through.toFixed(0)}%` : '—'}</td>
                <td className={td} style={mono}>{lo.avg_days != null ? `${lo.avg_days}d` : '—'}</td>
                <td className={td}>
                  {lo.goal_pct == null ? (
                    <Link href="/settings" className="text-xs text-[#8A6310] hover:underline">Goal not set</Link>
                  ) : (
                    <span className="inline-flex items-center gap-1" style={mono}>
                      {lo.goal_pct.toFixed(0)}%
                      {lo.goal_pct >= 100 ? <IconCheck size={13} color="#C9A95C" /> : lo.goal_pct < 75 ? <IconAlertTriangle size={13} color="#C4724A" /> : null}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
