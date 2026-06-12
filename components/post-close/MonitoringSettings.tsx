'use client';

import { useState } from 'react';
import type { MonitoringStatus, PostCloseMonitor } from '@/types/post-close';

interface Props {
  monitor: PostCloseMonitor;
  onUpdate: () => void;
}

const STATUSES: MonitoringStatus[] = ['active', 'paused', 'opted_out'];

export function MonitoringSettings({ monitor, onUpdate }: Props) {
  const [status, setStatus] = useState<MonitoringStatus>(monitor.monitoring_status);
  const [threshold, setThreshold] = useState(String(monitor.refi_alert_threshold ?? 0.75));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/post-close/${monitor.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monitoring_status: status,
        rate_trigger_threshold: parseFloat(threshold),
      }),
    });
    onUpdate();
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-2 block">Monitoring Status</label>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize ${
                status === s ? 'bg-[#C9A95C] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 block">Rate Drop Threshold (%)</label>
        <input
          type="number"
          step="0.25"
          min="0.25"
          max="3"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
        />
        <p className="text-xs text-gray-400 mt-1">
          Draft a rate-drop check-in when the market rate falls this far below their original rate.
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-[#C9A95C] text-white text-sm font-semibold hover:brightness-95 transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}
