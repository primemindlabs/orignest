'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSettings } from '@tabler/icons-react';
import type { PostCloseMonitorWithTriggers } from '@/types/post-close';
import { MonitoringSettings } from './MonitoringSettings';

const fmtCurrency = (v: number | null) => (v == null ? '—' : `$${Math.round(v / 1000)}k`);
const fmtRate = (v: number | null) => (v == null ? '—' : `${v.toFixed(3)}%`);
const fmtPct = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

interface Props {
  monitor: PostCloseMonitorWithTriggers;
  onUpdate: () => void;
}

export function EquityLoopCard({ monitor, onUpdate }: Props) {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const pendingCount = monitor.pending_triggers?.length ?? 0;

  const ltv =
    monitor.current_loan_balance != null && monitor.last_known_avm && monitor.last_known_avm > 0
      ? monitor.current_loan_balance / monitor.last_known_avm
      : null;
  const equityStrong = ltv != null && ltv <= 0.8;

  const closed = monitor.last_close_date
    ? new Date(monitor.last_close_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900">{monitor.full_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">Closed {closed}</p>
        </div>
        {pendingCount > 0 && (
          <span className="px-2.5 py-1 bg-[#C9A95C]/10 text-[#C9A95C] text-xs font-medium rounded-full">
            {pendingCount} outreach pending
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <Metric label="Orig. Rate" value={fmtRate(monitor.original_rate)} />
        <Metric label="Est. Equity" value={fmtCurrency(monitor.estimated_equity)} strong={equityStrong} />
        <Metric label="Est. LTV" value={fmtPct(ltv)} strong={equityStrong} />
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() =>
            router.push(monitor.lead_id ? `/leads/${monitor.lead_id}` : '/relationships')
          }
          className="flex-1 py-2 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
        >
          View Borrower
        </button>
        <button
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Monitoring settings"
          className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${
            showSettings ? 'border-[#C9A95C] text-[#C9A95C]' : 'border-gray-200 text-gray-400 hover:bg-gray-50'
          }`}
        >
          <IconSettings size={15} />
        </button>
      </div>

      {showSettings && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <MonitoringSettings
            monitor={monitor}
            onUpdate={() => {
              setShowSettings(false);
              onUpdate();
            }}
          />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-xl">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`font-semibold text-sm ${strong ? 'text-[#C9A95C]' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
