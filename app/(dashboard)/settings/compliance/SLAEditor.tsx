'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Check, X, Clock } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'Clear to Close',
};

interface SLARow {
  stage: string;
  warning_days: number;
  critical_days: number;
  is_custom: boolean;
}

export function SLAEditor({ initial, canEdit }: { initial: SLARow[]; canEdit: boolean }) {
  const [rows, setRows] = useState<SLARow[]>(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  function update(stage: string, field: 'warning_days' | 'critical_days', value: number) {
    setRows((cur) =>
      cur.map((r) => (r.stage === stage ? { ...r, [field]: Math.max(0, value) } : r))
    );
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings/sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sla: rows.map((r) => ({
            stage: r.stage,
            warning_days: r.warning_days,
            critical_days: r.critical_days,
          })),
        }),
      });
      const json = await res.json();
      setStatus(res.ok ? { ok: true, msg: 'Saved.' } : { ok: false, msg: json.error ?? 'Error' });
    } catch {
      setStatus({ ok: false, msg: 'Network error.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={15} className="text-label-2" />
        <h3 className="text-sm font-semibold text-black">Pipeline SLA thresholds</h3>
      </div>
      <p className="text-xs text-label-2 mb-4">
        Days a loan can sit in a stage before the pipeline flags it as approaching (amber) or
        critical (red).
      </p>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-1 pb-1">
          <span className="text-[11px] font-medium text-label-3 uppercase tracking-wide">Stage</span>
          <span className="text-[11px] font-medium text-label-3 uppercase tracking-wide w-20 text-center">
            Warning
          </span>
          <span className="text-[11px] font-medium text-label-3 uppercase tracking-wide w-20 text-center">
            Critical
          </span>
        </div>
        {rows.map((r) => (
          <div key={r.stage} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
            <span className="text-[13px] text-black">{STAGE_LABELS[r.stage] ?? r.stage}</span>
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={r.warning_days}
              onChange={(e) => update(r.stage, 'warning_days', Number(e.target.value))}
              className="w-20 h-8 rounded-[8px] border border-border bg-surface px-2 text-[13px] text-black text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-gold-300/40 disabled:opacity-50"
            />
            <input
              type="number"
              min={0}
              disabled={!canEdit}
              value={r.critical_days}
              onChange={(e) => update(r.stage, 'critical_days', Number(e.target.value))}
              className="w-20 h-8 rounded-[8px] border border-border bg-surface px-2 text-[13px] text-black text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-gold-300/40 disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3 justify-end mt-4 pt-4 border-t border-border">
          {status && (
            <span
              className={`inline-flex items-center gap-1.5 text-[13px] ${
                status.ok ? 'text-green' : 'text-red'
              }`}
            >
              {status.ok ? <Check size={14} /> : <X size={14} />}
              {status.msg}
            </span>
          )}
          <Button size="sm" onClick={save} loading={saving}>
            Save thresholds
          </Button>
        </div>
      )}
    </div>
  );
}
