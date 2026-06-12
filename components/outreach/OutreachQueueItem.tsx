'use client';

import { useState } from 'react';
import { IconMessage, IconMail, IconLock } from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { EVENT_META, type OutreachEventType } from './eventMeta';

export interface OutreachItem {
  id: string;
  event_type: OutreachEventType;
  scheduled_send_date: string;
  channel: 'sms' | 'email';
  message_draft: string;
  status: string;
  tcpa_acknowledged: boolean;
  sent_at?: string | null;
  contact: { name: string; phone: string | null; email: string | null };
}

interface Props {
  item: OutreachItem;
  onDone: (id: string) => void;
}

export function OutreachQueueItem({ item, onDone }: Props) {
  const isSms = item.channel === 'sms';
  const [tcpaChecked, setTcpaChecked] = useState(item.tcpa_acknowledged);
  const [busy, setBusy] = useState<null | 'send' | 'skip'>(null);
  const [error, setError] = useState<string | null>(null);

  const meta = EVENT_META[item.event_type] ?? EVENT_META.birthday;
  const Icon = meta.Icon;
  const ChannelIcon = isSms ? IconMessage : IconMail;
  const canSend = !busy && (!isSms || tcpaChecked);

  async function approveAndSend() {
    setError(null);
    setBusy('send');
    try {
      const approveRes = await fetch(`/api/outreach-queue/${item.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSms ? { tcpa_acknowledged: true } : {}),
      });
      if (!approveRes.ok) {
        const d = await approveRes.json().catch(() => ({}));
        throw new Error(d.error === 'TCPA_NOT_ACKNOWLEDGED' ? 'TCPA consent required' : 'Could not approve');
      }
      const sendRes = await fetch(`/api/outreach-queue/${item.id}/send`, { method: 'POST' });
      if (!sendRes.ok) {
        const d = await sendRes.json().catch(() => ({}));
        throw new Error(d.error === 'TCPA_NOT_ACKNOWLEDGED' ? 'TCPA consent required' : d.error ?? 'Send failed');
      }
      onDone(item.id);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
      setBusy(null);
    }
  }

  async function skip() {
    setError(null);
    setBusy('skip');
    try {
      const res = await fetch(`/api/outreach-queue/${item.id}/skip`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Could not skip');
      onDone(item.id);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--c-border)] bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="gold" size="sm">
            <Icon size={13} className="-ml-0.5" />
            {meta.label}
          </Badge>
          <span className="text-sm font-medium text-[var(--c-text)] truncate">{item.contact.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[var(--c-label2)] shrink-0">
          <ChannelIcon size={15} />
          <span className="uppercase">{item.channel}</span>
          <span>·</span>
          <span>{item.scheduled_send_date}</span>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-[var(--c-label)] bg-[var(--c-bg2,#f7f7f8)] rounded-lg px-3 py-2 whitespace-pre-wrap">
        {item.message_draft}
      </p>

      <div className="text-[12px] text-[var(--c-label3,#999)]">
        {isSms ? item.contact.phone ?? 'No phone on file' : item.contact.email ?? 'No email on file'}
      </div>

      {isSms && (
        <label className="flex items-start gap-2 text-[12px] text-[var(--c-label)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={tcpaChecked}
            onChange={(e) => setTcpaChecked(e.target.checked)}
            className="mt-0.5 accent-[#C9A95C]"
          />
          <span>
            I confirm {item.contact.name} has provided written consent to receive automated messages from me.
          </span>
        </label>
      )}

      {error && <p className="text-[12px] text-[#c0000a]">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={approveAndSend}
          disabled={!canSend}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#C9A95C] px-3 py-1.5 text-[13px] font-medium text-white hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {isSms && !tcpaChecked && <IconLock size={14} />}
          {busy === 'send' ? 'Sending…' : 'Approve & Send'}
        </button>
        <button
          onClick={skip}
          disabled={!!busy}
          className="rounded-lg border border-[var(--c-border)] px-3 py-1.5 text-[13px] text-[var(--c-label)] hover:bg-[var(--c-bg2,#f7f7f8)] disabled:opacity-40 transition"
        >
          {busy === 'skip' ? 'Skipping…' : 'Skip'}
        </button>
      </div>
    </div>
  );
}
