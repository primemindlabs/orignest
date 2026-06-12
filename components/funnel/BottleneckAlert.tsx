'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import { FUNNEL_STAGE_LABELS, nextStage, isFunnelStage, type FunnelStageName } from '@/lib/funnel/stages';

interface Props {
  stages: Array<{ name: string; entered_count: number; avg_days_in_stage: number | null; conversion_pct: number | null }>;
  bottleneckStage: string;
  bottleneckPct: number | null;
}

const labelOf = (s: string) => (isFunnelStage(s) ? FUNNEL_STAGE_LABELS[s] : s);

export function BottleneckAlert({ stages, bottleneckStage, bottleneckPct }: Props) {
  const stage = stages.find((s) => s.name === bottleneckStage);
  if (!stage) return null;
  const next = isFunnelStage(bottleneckStage) ? nextStage(bottleneckStage as FunnelStageName) : null;
  const stalledCount = stage.entered_count - (stages.find((s) => s.name === next)?.entered_count ?? 0);

  return (
    <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <IconAlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-amber-900">Pipeline bottleneck detected</p>
        <p className="text-sm text-amber-700">
          <span className="font-semibold">{labelOf(bottleneckStage)}{next ? ` → ${FUNNEL_STAGE_LABELS[next]}` : ''}</span>{' '}
          has only <span className="font-semibold">{bottleneckPct?.toFixed(0) ?? '—'}% conversion</span>.{' '}
          {stalledCount > 0 && (
            <>{stalledCount} lead{stalledCount !== 1 ? 's' : ''} stalled{stage.avg_days_in_stage !== null ? ` avg ${stage.avg_days_in_stage}d` : ''}.</>
          )}
        </p>
      </div>
    </div>
  );
}
