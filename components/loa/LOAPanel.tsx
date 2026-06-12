'use client';

import { useState, useCallback } from 'react';
import { IconBrain, IconX } from '@tabler/icons-react';
import { LOAChatWindow } from './LOAChatWindow';
import { LOAQuickChips } from './LOAQuickChips';
import { LOAInput } from './LOAInput';
import { LOARateLimitBanner } from './LOARateLimitBanner';
import type { LOAMessageData } from './LOAMessage';

interface LOAPanelProps {
  open: boolean;
  onClose: () => void;
}

const DAILY_LIMIT = 50;

export function LOAPanel({ open, onClose }: LOAPanelProps) {
  const [messages, setMessages] = useState<LOAMessageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [inputValue, setInputValue] = useState('');

  const showRateLimitBanner = queriesUsed >= DAILY_LIMIT * 0.8;

  const sendQuestion = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || loading) return;

      setMessages((prev) => [...prev, { role: 'user', content: q, timestamp: new Date() }]);
      setInputValue('');
      setLoading(true);

      try {
        const res = await fetch('/api/loa/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        });

        if (res.status === 429) {
          const data = await res.json();
          setQueriesUsed(data.queries_used ?? DAILY_LIMIT);
          setMessages((prev) => [
            ...prev,
            {
              role: 'loa',
              content: `You've reached your daily limit of ${data.limit ?? DAILY_LIMIT} queries. Resets in ~24 hours.`,
              timestamp: new Date(),
            },
          ]);
          return;
        }

        if (!res.ok) {
          setMessages((prev) => [
            ...prev,
            { role: 'loa', content: 'Something went wrong. Please try again.', timestamp: new Date() },
          ]);
          return;
        }

        const data = await res.json();
        setQueriesUsed((prev) => prev + 1);
        setMessages((prev) => [
          ...prev,
          { role: 'loa', content: data.answer, sources: data.sources, timestamp: new Date() },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'loa', content: 'Something went wrong. Please try again.', timestamp: new Date() },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20" onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <IconBrain size={20} className="text-violet-600" />
            <span className="font-semibold text-gray-900 text-sm">LOA</span>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              Internal
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close LOA panel"
            className="rounded p-1 text-gray-400 hover:text-gray-600"
          >
            <IconX size={18} />
          </button>
        </div>

        {showRateLimitBanner && <LOARateLimitBanner used={queriesUsed} limit={DAILY_LIMIT} />}

        <LOAChatWindow messages={messages} loading={loading} />

        <LOAQuickChips onSelect={sendQuestion} disabled={loading || queriesUsed >= DAILY_LIMIT} />

        <LOAInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={sendQuestion}
          loading={loading}
          disabled={queriesUsed >= DAILY_LIMIT}
        />
      </div>
    </div>
  );
}
