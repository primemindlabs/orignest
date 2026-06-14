'use client';

import { useState } from 'react';
import { IconChevronDown, IconChevronUp, IconX, IconCheck } from '@tabler/icons-react';

export type QueueAction = {
  id: string;
  action_type: string;
  signal_type: string;
  signal_reason: string;
  recommended_content: string | null;
  recommended_subject: string | null;
  entity_name: string;
  priority: number;
};

const ACTION_ICONS: Record<string, string> = {
  send_sms: '💬',
  send_email: '📧',
  internal_alert: '⚠️',
  trigger_workflow: '⚡',
  schedule_call_reminder: '📞',
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Urgent', color: '#C4724A' },
  2: { label: 'High', color: '#C9A95C' },
  3: { label: 'High', color: '#C9A95C' },
};

type Props = {
  action: QueueAction;
  onApprove: (action: QueueAction) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
};

export function AutopilotActionCard({ action, onApprove, onReject }: Props) {
  const [showDraft, setShowDraft] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const prio = PRIORITY_LABELS[action.priority];

  return (
    <div className="px-6 py-4">
      <div className="flex items-start gap-4">
        {/* Icon + priority */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
          <span className="text-lg">{ACTION_ICONS[action.action_type] ?? '•'}</span>
          {prio && (
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded"
              style={{ color: prio.color, backgroundColor: `${prio.color}15` }}
            >
              {prio.label}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1A1A1A]">{action.entity_name}</p>
          <p className="text-sm text-[#4A4A4A] mt-0.5 leading-snug">{action.signal_reason}</p>

          {action.recommended_content && (
            <div className="mt-2">
              <button
                onClick={() => setShowDraft((v) => !v)}
                className="text-xs text-[#876830] flex items-center gap-1 hover:underline"
              >
                {showDraft ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                {showDraft ? 'Hide draft' : action.action_type === 'send_email' ? 'View draft email' : 'View draft message'}
              </button>
              {showDraft && (
                <div className="mt-2 bg-[#F9F7F4] rounded-lg px-4 py-3 text-sm text-[#4A4A4A] leading-relaxed whitespace-pre-wrap">
                  {action.recommended_subject && (
                    <p className="font-medium text-[#1A1A1A] mb-1">{action.recommended_subject}</p>
                  )}
                  {action.recommended_content}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Approve / Reject */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowRejectInput((v) => !v)}
            disabled={busy !== null}
            className="p-2 text-[#6B7B8D] hover:text-[#C4724A] hover:bg-[#FFF4F0] rounded-lg transition-colors disabled:opacity-40"
            aria-label="Skip"
          >
            <IconX size={16} />
          </button>
          <button
            onClick={async () => {
              setBusy('approve');
              try {
                await onApprove(action);
              } finally {
                setBusy(null);
              }
            }}
            disabled={busy !== null}
            className="flex items-center gap-1.5 bg-[#F0F9F4] text-[#1A7A45] text-sm px-4 py-2 rounded-lg hover:bg-[#E0F4EA] transition-colors font-medium disabled:opacity-50"
          >
            <IconCheck size={14} />
            {action.action_type === 'internal_alert' || action.action_type === 'schedule_call_reminder' ? 'Got it' : 'Approve'}
          </button>
        </div>
      </div>

      {/* Reject input */}
      {showRejectInput && (
        <div className="mt-3 ml-10 flex gap-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why skip? (optional)"
            className="flex-1 text-sm border border-[#E8E4DE] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#C9A95C]"
            onKeyDown={async (e) => {
              if (e.key === 'Enter') {
                setBusy('reject');
                try {
                  await onReject(action.id, rejectReason || undefined);
                } finally {
                  setBusy(null);
                }
              }
            }}
          />
          <button
            onClick={async () => {
              setBusy('reject');
              try {
                await onReject(action.id, rejectReason || undefined);
              } finally {
                setBusy(null);
              }
            }}
            disabled={busy !== null}
            className="text-sm text-[#6B7B8D] hover:text-[#1A1A1A] px-3 py-2 disabled:opacity-40"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
