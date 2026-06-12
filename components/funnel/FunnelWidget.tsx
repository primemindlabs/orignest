'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconChartBar, IconAlertTriangle } from '@tabler/icons-react';
import { FUNNEL_STAGE_LABELS, isFunnelStage } from '@/lib/funnel/stages';
import type { FunnelResult, FunnelStageData } from '@/lib/funnel/compute';

const labelOf = (s: string) => (isFunnelStage(s) ? FUNNEL_STAGE_LABELS[s] : s);

export function FunnelWidget() {
  const router = useRouter();
  const [data, setData] = useState<FunnelResult | null>(null);

  useEffect(() => {
    fetch('/api/analytics/funnel?period=90').then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d));
  }, []);

  if (!data) return null;
  const topStages = data.stages.slice(0, 4);
  const hasBottleneck = data.bottleneck_stage && (data.bottleneck_conversion_pct ?? 100) < 60;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconChartBar size={16} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Funnel (90d)</span>
        </div>
        <button onClick={() => router.push('/analytics/funnel')} className="text-xs text-[#C9A95C] hover:underline">Full view</button>
      </div>

      <div className="space-y-1.5">
        {topStages.map((stage: FunnelStageData) => (
          <div key={stage.name} className="flex items-center justify-between text-xs">
            <span className="text-gray-600">{labelOf(stage.name)}</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-900 font-medium tabular-nums">{stage.entered_count}</span>
              {stage.conversion_pct !== null && (
                <span className={`tabular-nums ${stage.conversion_pct < 50 ? 'text-red-500' : stage.conversion_pct < 70 ? 'text-amber-500' : 'text-green-600'}`}>
                  {stage.conversion_pct.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasBottleneck && (
        <div className="flex items-center gap-1.5 bg-amber-50 rounded-lg px-2.5 py-1.5">
          <IconAlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700">
            Bottleneck: <span className="font-medium">{labelOf(data.bottleneck_stage as string)}</span> ({data.bottleneck_conversion_pct?.toFixed(0)}%)
          </span>
        </div>
      )}
    </div>
  );
}
