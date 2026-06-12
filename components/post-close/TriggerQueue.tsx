'use client';

import { useState } from 'react';
import { IconSend, IconX, IconAlertTriangle } from '@tabler/icons-react';
import type { PostCloseMonitorWithTriggers } from '@/types/post-close';

const TRIGGER_LABELS: Record<string, string> = {
  rate_drop: 'Rate Drop Alert',
  equity_gain: 'Equity Gain',
  anniversary: 'Anniversary',
  manual: 'Manual',
};

interface Props {
  monitors: PostCloseMonitorWithTriggers[];
  onAction: () => void;
}

export function TriggerQueue({ monitors, onAction }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const allPending = monitors
    .flatMap((m) => (m.pending_triggers ?? []).map((t) => ({ ...t, borrower: m.full_name })))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  async function act(id: string, action: 'send' | 'skip') {
    setBusy(id);
    await fetch(`/api/post-close/triggers/${id}/${action}`, { method: 'POST' });
    await onAction();
    setBusy(null);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="font-semibold text-gray-900 mb-3">Outreach Queue</p>
      {allPending.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No pending outreach</p>
      ) : (
        <div className="space-y-3">
          {allPending.map((t) => (
            <div key={t.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">{TRIGGER_LABELS[t.trigger_type]}</p>
                {t.requires_review && (
                  <div className="flex items-center gap-1 text-xs text-[#C9A95C]">
                    <IconAlertTriangle size={12} />
                    Review required
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 font-medium">{t.borrower}</p>
              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-2 rounded-lg line-clamp-3">
                {t.outreach_message}
              </p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => act(t.id, 'skip')}
                  disabled={busy === t.id}
                  aria-label="Skip"
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <IconX size={13} />
                </button>
                <button
                  onClick={() => act(t.id, 'send')}
                  disabled={busy === t.id}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[#C9A95C] text-white text-xs font-medium hover:brightness-95 transition-colors disabled:opacity-50"
                >
                  <IconSend size={12} />
                  {busy === t.id ? 'Working…' : 'Send'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
