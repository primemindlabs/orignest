'use client';

import { useCallback, useEffect, useState } from 'react';
import { IconConfetti } from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { OutreachQueueItem, type OutreachItem } from './OutreachQueueItem';
import { EVENT_META, type OutreachEventType } from './eventMeta';

type Tab = 'queue' | 'sent';

export function OutreachClient() {
  const [tab, setTab] = useState<Tab>('queue');
  const [queue, setQueue] = useState<OutreachItem[]>([]);
  const [sent, setSent] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    const status = which === 'queue' ? 'active' : 'sent';
    try {
      const res = await fetch(`/api/outreach-queue?status=${status}`);
      const data = await res.json();
      if (which === 'queue') setQueue(data.items ?? []);
      else setSent(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const handleDone = useCallback((id: string) => {
    setQueue((prev) => prev.filter((i) => i.id !== id));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-[var(--c-border)]">
        <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>
          Approval Queue
          {queue.length > 0 && (
            <Badge variant="gold" size="sm" className="ml-1.5">
              {queue.length}
            </Badge>
          )}
        </TabButton>
        <TabButton active={tab === 'sent'} onClick={() => setTab('sent')}>
          Sent History
        </TabButton>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--c-label2)] py-8 text-center">Loading…</p>
      ) : tab === 'queue' ? (
        queue.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <OutreachQueueItem key={item.id} item={item} onDone={handleDone} />
            ))}
          </div>
        )
      ) : sent.length === 0 ? (
        <p className="text-sm text-[var(--c-label2)] py-8 text-center">No outreach sent yet.</p>
      ) : (
        <div className="divide-y divide-[var(--c-border)] rounded-xl border border-[var(--c-border)] bg-white">
          {sent.map((item) => {
            const meta = EVENT_META[item.event_type as OutreachEventType] ?? EVENT_META.birthday;
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <meta.Icon size={15} className="text-[#C9A95C] shrink-0" />
                  <span className="text-sm text-[var(--c-text)] truncate">{item.contact.name}</span>
                  <span className="text-[12px] text-[var(--c-label3,#999)] truncate hidden sm:inline">
                    {item.message_draft}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--c-label2)] shrink-0">
                  {item.channel.toUpperCase()} ·{' '}
                  {item.sent_at ? new Date(item.sent_at).toLocaleDateString() : item.scheduled_send_date}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center px-3 py-2 text-[13px] font-medium transition ${
        active ? 'text-[var(--c-text)]' : 'text-[var(--c-label2)] hover:text-[var(--c-text)]'
      }`}
    >
      {children}
      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-[#C9A95C]" />}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <IconConfetti size={28} className="text-[#C9A95C]" />
      <p className="mt-3 text-sm font-medium text-[var(--c-text)]">You're all caught up</p>
      <p className="mt-1 text-[13px] text-[var(--c-label2)]">
        New birthdays and anniversaries appear here as they approach.
      </p>
    </div>
  );
}
