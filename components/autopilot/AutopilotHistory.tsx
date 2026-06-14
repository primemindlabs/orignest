'use client';

import { useEffect, useState } from 'react';
import { IconBolt } from '@tabler/icons-react';

type HistoryAction = {
  id: string;
  signal_type: string;
  action_type: string;
  entity_name: string;
  signal_reason: string;
  status: string;
  generated_date: string;
  executed_at: string | null;
  failure_reason: string | null;
};

const SIGNAL_LABELS: Record<string, string> = {
  condition_aging: 'Condition aging',
  rate_lock_expiring: 'Rate lock expiring',
  heat_score_drop: 'Realtor cooling',
  realtor_dormant: 'Realtor dormant',
  birthday: 'Birthday',
  fallout_risk: 'Fallout risk',
  post_close_equity: 'Equity milestone',
  new_arrive_lead: 'New Arrive lead',
};

const ACTION_LABELS: Record<string, string> = {
  send_sms: 'SMS',
  send_email: 'Email',
  internal_alert: 'Alert',
  trigger_workflow: 'Workflow',
  schedule_call_reminder: 'Call reminder',
};

function outcome(a: HistoryAction): { label: string; cls: string } {
  switch (a.status) {
    case 'executed':
      return a.failure_reason
        ? { label: `Blocked (${a.failure_reason.split(':')[0]})`, cls: 'text-[#C4724A]' }
        : { label: 'Sent / done', cls: 'text-[#1A7A45]' };
    case 'approved':
      return { label: 'Approved — sending', cls: 'text-[#876830]' };
    case 'pending':
      return { label: 'Pending review', cls: 'text-[#6B7B8D]' };
    case 'rejected':
      return { label: 'Skipped', cls: 'text-[#6B7B8D]' };
    case 'undone':
      return { label: 'Undone', cls: 'text-[#6B7B8D]' };
    case 'expired':
      return { label: 'Expired', cls: 'text-[#6B7B8D]' };
    default:
      return { label: a.status, cls: 'text-[#6B7B8D]' };
  }
}

export function AutopilotHistory() {
  const [actions, setActions] = useState<HistoryAction[] | null>(null);

  useEffect(() => {
    fetch('/api/autopilot/history')
      .then((r) => r.json())
      .then((d) => setActions((d.actions ?? []) as HistoryAction[]))
      .catch(() => setActions([]));
  }, []);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-2 mb-1">
        <IconBolt size={20} className="text-[#C9A95C]" />
        <h1 className="text-xl font-semibold text-[#1A1A1A]" style={{ fontFamily: 'var(--font-lora), Lora, serif' }}>
          Autopilot history
        </h1>
      </div>
      <p className="text-sm text-[#6B7B8D] mb-5">
        The last 30 days of actions Ashley recommended and what happened — the trust record behind Autopilot.
      </p>

      <div className="bg-white rounded-2xl border border-[#E8E4DE] overflow-hidden">
        <div className="grid grid-cols-[110px_1fr_140px_90px_150px] gap-3 px-5 py-3 border-b border-[#F0EDE8] text-xs font-medium text-[#6B7B8D] uppercase tracking-wide">
          <div>Date</div>
          <div>Entity</div>
          <div>Signal</div>
          <div>Action</div>
          <div>Outcome</div>
        </div>

        {actions === null && <div className="px-5 py-8 text-sm text-[#6B7B8D]">Loading…</div>}
        {actions !== null && actions.length === 0 && (
          <div className="px-5 py-8 text-sm text-[#6B7B8D]">No Autopilot activity yet.</div>
        )}

        <div className="divide-y divide-[#F4F2EF]">
          {(actions ?? []).map((a) => {
            const o = outcome(a);
            return (
              <div key={a.id} className="grid grid-cols-[110px_1fr_140px_90px_150px] gap-3 px-5 py-3 text-sm items-center">
                <div className="text-[#6B7B8D]">{a.generated_date}</div>
                <div className="text-[#1A1A1A] font-medium truncate" title={a.signal_reason}>{a.entity_name}</div>
                <div className="text-[#4A4A4A]">{SIGNAL_LABELS[a.signal_type] ?? a.signal_type}</div>
                <div className="text-[#4A4A4A]">{ACTION_LABELS[a.action_type] ?? a.action_type}</div>
                <div className={o.cls}>{o.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
