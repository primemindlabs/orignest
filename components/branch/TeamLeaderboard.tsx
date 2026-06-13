'use client';

import { IconChevronRight, IconAlertTriangle } from '@tabler/icons-react';
import type { LOProfileSummary } from '@/types/branch-manager';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v);

export function TeamLeaderboard({ team, onViewLO }: { team: LOProfileSummary[]; onViewLO: (loId: string) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <h2 className="font-semibold text-gray-900">Team Leaderboard</h2>
        <p className="text-xs text-gray-400">Sorted by pipeline value</p>
      </div>
      <div className="divide-y divide-gray-50">
        {team.map((lo, idx) => (
          <button key={lo.lo_id} onClick={() => onViewLO(lo.lo_id)} className="w-full text-left px-5 py-4 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-center gap-3">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  idx === 0 ? 'bg-[#C9A95C] text-white' : idx === 1 ? 'bg-gray-200 text-gray-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {idx + 1}
              </span>
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {lo.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lo.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-gray-500">{lo.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm truncate">{lo.name}</p>
                  {lo.metrics.trid_alerts_open > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-red-500">
                      <IconAlertTriangle size={11} />
                      {lo.metrics.trid_alerts_open}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                  <span>{lo.metrics.leads_active} active</span>
                  <span>{lo.metrics.loans_funded_30d} funded</span>
                  {lo.metrics.conversion_rate != null && <span>{(lo.metrics.conversion_rate * 100).toFixed(0)}% conv.</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-gray-900 text-sm">{fmt(lo.metrics.pipeline_value)}</p>
                <p className="text-xs text-gray-400">pipeline</p>
              </div>
              <IconChevronRight size={14} className="text-gray-300 flex-shrink-0" />
            </div>
          </button>
        ))}
        {team.length === 0 && <div className="px-5 py-12 text-center text-gray-400 text-sm">No team members found</div>}
      </div>
    </div>
  );
}
