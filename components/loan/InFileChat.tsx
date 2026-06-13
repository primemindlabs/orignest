'use client';

// Phase 109 — internal team chat panel for a loan file. Polls every 5s (the app's
// pattern; not Supabase Realtime). Internal-only — borrowers never see this thread.
import { useEffect, useRef, useState, useCallback } from 'react';
import { IconLock, IconUsers } from '@tabler/icons-react';
import { ChatMessage, type InternalChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function InFileChat({ loanId }: { loanId: string }) {
  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/loans/${loanId}/internal-chat`);
      if (res.status === 403) {
        setDenied(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      /* keep last good state */
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = useCallback(
    async (text: string) => {
      await fetch(`/api/loans/${loanId}/internal-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      await load();
    },
    [loanId, load]
  );

  if (denied) {
    return (
      <div className="bg-[#FAFAF8] rounded-2xl border border-gray-100 p-10 text-center">
        <IconLock size={26} className="mx-auto text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-700">Internal chat is restricted</p>
        <p className="mt-1 text-xs text-gray-400">Only the assigned LO, processors, LOAs, and managers can view this file's team chat.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAF8] rounded-2xl border border-gray-100 overflow-hidden flex flex-col h-[70vh]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <IconUsers size={16} className="text-[#C9A95C]" />
        <p className="text-sm font-semibold text-gray-900">Internal Team Chat</p>
        <span className="text-[11px] text-gray-400">· internal only — borrowers can't see this</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <p className="text-center text-sm text-gray-400 mt-8">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-8">
            No messages yet. Start the conversation about this file with your team.
          </p>
        ) : (
          messages.map((m) => <ChatMessage key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput onSend={send} />
    </div>
  );
}
