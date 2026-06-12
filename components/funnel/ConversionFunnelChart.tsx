'use client';

import type { FunnelStageData } from '@/lib/funnel/compute';

interface Props {
  stages: FunnelStageData[];
  onStageClick: (stage: string) => void;
}

// Gradient: gray at inquiry → amber → brand gold at clear_to_close → green at funded.
const STAGE_COLORS = ['#9CA3AF', '#6B7280', '#D97706', '#B45309', '#92400E', '#C9A95C', '#C9A95C', '#16A34A'];

export function ConversionFunnelChart({ stages, onStageClick }: Props) {
  const maxCount = stages[0]?.entered_count ?? 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
      <div className="grid grid-cols-[160px_1fr_80px_80px] text-xs text-gray-400 font-medium uppercase tracking-wide pb-2 border-b border-gray-100">
        <span>Stage</span>
        <span>Volume</span>
        <span className="text-right">Leads</span>
        <span className="text-right">→ Next</span>
      </div>

      {stages.map((stage, i) => {
        const barWidth = maxCount > 0 ? Math.max((stage.entered_count / maxCount) * 100, 2) : 2;
        const color = STAGE_COLORS[i] ?? '#9CA3AF';
        return (
          <button
            key={stage.name}
            onClick={() => onStageClick(stage.name)}
            className="grid grid-cols-[160px_1fr_80px_80px] items-center w-full text-left group hover:bg-gray-50 rounded-lg px-2 py-2 -mx-2 transition-colors"
          >
            <span className="text-sm text-gray-700 font-medium truncate pr-2">{stage.label}</span>
            <div className="relative h-8 flex items-center">
              <div className="h-7 rounded-md flex items-center px-2.5 transition-all" style={{ width: `${barWidth}%`, backgroundColor: color, minWidth: '24px' }}>
                {stage.avg_days_in_stage !== null ? (
                  <span className="text-white text-xs font-medium whitespace-nowrap">{stage.avg_days_in_stage}d avg</span>
                ) : stage.entered_count >= 1 ? (
                  <span className="text-white text-xs font-medium whitespace-nowrap opacity-60">—</span>
                ) : null}
              </div>
            </div>
            <span className="text-sm text-gray-700 text-right tabular-nums">{stage.entered_count}</span>
            <span className={`text-sm text-right tabular-nums font-medium ${stage.conversion_pct === null ? 'text-gray-300' : stage.conversion_pct < 50 ? 'text-red-500' : stage.conversion_pct < 70 ? 'text-amber-500' : 'text-green-600'}`}>
              {stage.conversion_pct === null ? '—' : `${stage.conversion_pct.toFixed(0)}%`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
