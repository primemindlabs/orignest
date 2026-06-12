'use client';

/** Phase 98 — sortable ROI table. Default sort: ROI desc, null ROI rows last. */
import { useState, useMemo } from 'react';
import { IconArrowUp, IconArrowDown, IconChartBar } from '@tabler/icons-react';
import { SourceBadge } from '@/components/leads/SourceBadge';
import { roiTier, formatROI, formatCloseRate, formatCostPerClosed, formatUSD } from '@/lib/analytics/roi';
import { SOURCE_SELECT_LABELS } from '@/lib/analytics/sources';
import type { ReferralROIRow } from '@/types/analytics';

type SortKey = 'leads_count' | 'closed_count' | 'close_rate' | 'total_cost' | 'cost_per_closed' | 'roi_multiple';
const COLS: { key: SortKey; label: string }[] = [
  { key: 'leads_count', label: 'Leads' },
  { key: 'closed_count', label: 'Closed' },
  { key: 'close_rate', label: 'Close Rate' },
  { key: 'total_cost', label: 'Cost' },
  { key: 'cost_per_closed', label: 'Cost / Closed' },
  { key: 'roi_multiple', label: 'ROI' },
];

const ROI_PILL: Record<string, string> = {
  strong: 'text-green-700 bg-green-50', moderate: 'text-amber-700 bg-amber-50', weak: 'text-red-700 bg-red-50',
};

export function ROITable({ rows }: { rows: ReferralROIRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('roi_multiple');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Nulls always sort to the bottom regardless of direction.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return arr;
  }, [rows, sortKey, dir]);

  function toggle(key: SortKey) {
    if (key === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setDir('desc'); }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-12 text-center">
        <IconChartBar size={26} className="mx-auto text-gray-300" />
        <p className="text-sm text-gray-500 mt-2">No referral source data for this period. Tag leads with a source to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left font-medium text-gray-500 px-4 py-2.5 text-xs uppercase tracking-wide">Source</th>
            {COLS.map((c) => (
              <th key={c.key} className="text-right px-3 py-2.5">
                <button onClick={() => toggle(c.key)} className={`inline-flex items-center gap-1 text-xs uppercase tracking-wide font-medium ${sortKey === c.key ? 'text-[#C9A95C]' : 'text-gray-500'}`}>
                  {c.label}
                  {sortKey === c.key && (dir === 'asc' ? <IconArrowUp size={13} /> : <IconArrowDown size={13} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((r, i) => {
            const tier = roiTier(r.roi_multiple);
            return (
              <tr key={`${r.source_type}-${r.source_detail ?? ''}-${i}`} className="hover:bg-[#FAFAF8]">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <SourceBadge source={r.source_type} size="sm" />
                    {r.source_detail && <span className="text-xs text-gray-500 truncate">{r.source_detail}</span>}
                    {r.source_type === 'untagged' && <span className="text-xs text-gray-400">{SOURCE_SELECT_LABELS.untagged}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-gray-700" style={{ fontFamily: "'DM Mono', monospace" }}>{r.leads_count}</td>
                <td className="px-3 py-2.5 text-right text-gray-700" style={{ fontFamily: "'DM Mono', monospace" }}>{r.closed_count}</td>
                <td className="px-3 py-2.5 text-right text-gray-700">{formatCloseRate(r.close_rate)}</td>
                <td className="px-3 py-2.5 text-right text-gray-700">{r.total_cost > 0 ? formatUSD(r.total_cost) : '—'}</td>
                <td className="px-3 py-2.5 text-right text-gray-700">{formatCostPerClosed(r.cost_per_closed)}</td>
                <td className="px-3 py-2.5 text-right">
                  {r.roi_multiple === null
                    ? <span className="text-gray-400">—</span>
                    : <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ROI_PILL[tier]}`} style={{ fontFamily: "'DM Mono', monospace" }}>{formatROI(r.roi_multiple)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
