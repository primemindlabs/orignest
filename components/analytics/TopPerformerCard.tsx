'use client';

/** Phase 98 — best / worst ROI source cards. */
import { formatROI, formatCloseRate, formatCostPerClosed } from '@/lib/analytics/roi';
import { SOURCE_SELECT_LABELS } from '@/lib/analytics/sources';
import type { ReferralROIRow } from '@/types/analytics';

function label(r: ReferralROIRow): string {
  const base = SOURCE_SELECT_LABELS[r.source_type] ?? r.source_type;
  return r.source_detail ? `${base} · ${r.source_detail}` : base;
}

function Card({ row, kind }: { row: ReferralROIRow; kind: 'best' | 'worst' }) {
  const isBest = kind === 'best';
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <span className={`inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${isBest ? 'bg-[#F5EFE0] text-[#8A6310]' : 'bg-red-100 text-red-700'}`}>
        {isBest ? 'Top Performer' : 'Needs Attention'}
      </span>
      <p className="text-sm font-semibold text-gray-900 mt-2 truncate">{label(row)}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1" style={{ fontFamily: "'DM Mono', monospace" }}>
        {formatROI(row.roi_multiple)}
        {row.roi_multiple === null && <span className="text-xs font-normal text-gray-400 ml-2 align-middle">No cost tracked</span>}
      </p>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
        <span>Close rate {formatCloseRate(row.close_rate)}</span>
        <span>Cost/closed {formatCostPerClosed(row.cost_per_closed)}</span>
      </div>
    </div>
  );
}

export function TopPerformerCard({ rows }: { rows: ReferralROIRow[] }) {
  const withLeads = rows.filter((r) => r.leads_count > 0 && r.source_type !== 'untagged');
  if (withLeads.length === 0) return null;

  const best = withLeads[0]; // rows arrive sorted by ROI desc
  // Worst: lowest real (non-null) ROI; need >= 2 sources to compare.
  const withCost = withLeads.filter((r) => r.roi_multiple !== null);
  const worst = withCost.length >= 2 ? withCost[withCost.length - 1] : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card row={best} kind="best" />
      {worst && worst !== best && <Card row={worst} kind="worst" />}
    </div>
  );
}
