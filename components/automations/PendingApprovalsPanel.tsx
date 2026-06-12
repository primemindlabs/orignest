'use client';

import { useEffect, useState, useCallback } from 'react';
import { IconSend, IconX, IconBell } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

interface PendingItem {
  id: string;
  action_type: string;
  rendered_message: string;
  recipient_type: string;
  triggered_at: string;
  lead: { first_name: string | null; last_name: string | null } | null;
  rule: { rule_name: string } | null;
}

export function PendingApprovalsPanel() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/automations/log?status=pending');
    const data = await res.json();
    setItems(data.log ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(`/api/automations/log/${id}/approve`, { method: 'POST' });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? 'Send failed');
    await load();
    setBusy(null);
  }

  async function skip(id: string) {
    setBusy(id);
    await fetch(`/api/automations/log/${id}/skip`, { method: 'POST' });
    await load();
    setBusy(null);
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
        <IconBell size={28} className="mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 font-medium">Nothing waiting for approval</p>
        <p className="text-sm text-gray-400 mt-1">Queued messages appear here when loans hit a trigger stage.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {item.lead?.first_name ?? 'Borrower'} {item.lead?.last_name ?? ''}
              </p>
              <p className="text-xs text-gray-400">
                {item.rule?.rule_name ?? item.action_type} · {formatDistanceToNow(new Date(item.triggered_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed line-clamp-3 mb-3">
            {item.rendered_message}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => skip(item.id)}
              disabled={busy === item.id}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-50"
            >
              <IconX size={12} />
              Skip
            </button>
            <button
              onClick={() => approve(item.id)}
              disabled={busy === item.id}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#C9A95C] text-white text-xs font-semibold hover:brightness-95 transition-colors disabled:opacity-50"
            >
              <IconSend size={12} />
              {busy === item.id ? 'Working…' : 'Approve & Send'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
