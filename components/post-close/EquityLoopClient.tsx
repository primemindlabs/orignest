'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconHome, IconTrendingDown, IconChartBar, IconBolt } from '@tabler/icons-react';
import { EquityLoopCard } from './EquityLoopCard';
import { TriggerQueue } from './TriggerQueue';
import type { PostCloseMonitorWithTriggers } from '@/types/post-close';

export function EquityLoopClient() {
  const [monitors, setMonitors] = useState<PostCloseMonitorWithTriggers[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch('/api/post-close');
    const data = await res.json();
    setMonitors(data.monitors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pending = monitors.flatMap((m) => m.pending_triggers ?? []);
  const stats = {
    totalActive: monitors.filter((m) => m.monitoring_status === 'active').length,
    pending: pending.length,
    rateDrop: pending.filter((t) => t.trigger_type === 'rate_drop').length,
    equity: pending.filter((t) => t.trigger_type === 'equity_gain').length,
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Post-Close Equity Loop</h1>
        <p className="text-sm text-gray-500 mt-0.5">Stay top-of-mind with past borrowers</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Monitors', value: stats.totalActive, icon: IconHome },
          { label: 'Pending Outreach', value: stats.pending, icon: IconBolt, gold: true },
          { label: 'Rate Drop', value: stats.rateDrop, icon: IconTrendingDown },
          { label: 'Equity Gain', value: stats.equity, icon: IconChartBar },
        ].map(({ label, value, icon: Icon, gold }) => (
          <div key={label} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center gap-3">
            <Icon size={18} className={gold ? 'text-[#C9A95C]' : 'text-gray-400'} />
            <div>
              <p className="text-lg font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : monitors.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center">
          <IconHome size={26} className="text-[#C9A95C] mx-auto" />
          <p className="mt-3 text-sm font-medium text-gray-900">No monitored borrowers yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Funded borrowers appear here as their post-close relationship records build up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {monitors.map((m) => (
              <EquityLoopCard key={m.id} monitor={m} onUpdate={load} />
            ))}
          </div>
          <div>
            <TriggerQueue monitors={monitors} onAction={load} />
          </div>
        </div>
      )}
    </div>
  );
}
