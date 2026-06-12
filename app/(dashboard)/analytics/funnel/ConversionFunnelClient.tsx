'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PeriodSelector } from '@/components/funnel/PeriodSelector';
import { ConversionFunnelChart } from '@/components/funnel/ConversionFunnelChart';
import { BottleneckAlert } from '@/components/funnel/BottleneckAlert';
import type { FunnelResult } from '@/lib/funnel/compute';

type Period = 30 | 60 | 90 | 180;

export function ConversionFunnelClient() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(90);
  const [data, setData] = useState<FunnelResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/funnel?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); });
  }, [period]);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Conversion Funnel</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track how leads move from inquiry to funded.</p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {loading || !data ? (
        <div className="h-80 flex items-center justify-center text-sm text-gray-400">Loading funnel data…</div>
      ) : (
        <>
          <ConversionFunnelChart stages={data.stages} onStageClick={(s) => router.push(`/pipeline?stage=${s}`)} />
          {data.bottleneck_stage && (data.bottleneck_conversion_pct ?? 100) < 60 && (
            <BottleneckAlert stages={data.stages} bottleneckStage={data.bottleneck_stage} bottleneckPct={data.bottleneck_conversion_pct} />
          )}
        </>
      )}
    </div>
  );
}
