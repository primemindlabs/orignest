'use client';

/**
 * Phase 31.1 — token-gated portal chat (borrower / co-borrower / realtor).
 * Shared by both portals. Live updates via polling. The API enforces visibility
 * server-side, so a participant only ever receives messages meant for them.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';

interface Msg {
  id: string;
  sender_type: string;
  content: string;
  created_at: string;
}

function time(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function PortalChat({
  apiBase,
  selfType,
  loName,
  accent = '#C9A95C',
}: {
  apiBase: string;
  selfType: 'borrower' | 'coborrower' | 'realtor';
  loName: string;
  accent?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiBase);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      /* ignore poll errors */
    }
  }, [apiBase]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send');
      setInput('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function label(t: string) {
    if (t === 'lo') return loName;
    if (t === 'system') return '';
    if (t === 'realtor') return 'Realtor';
    if (t === 'coborrower') return 'Co-Borrower';
    return 'You';
  }

  return (
    <div className="bg-white rounded-[10px] border border-[rgba(60,60,67,0.06)] shadow-card flex flex-col" style={{ height: 420 }}>
      <div className="px-4 py-3 border-b border-[rgba(60,60,67,0.08)]">
        <h2 className="text-sm font-semibold text-label">Messages with {loName}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {messages.length === 0 && <p className="text-[13px] text-label-3 text-center py-6">No messages yet.</p>}
        {messages.map((m) => {
          if (m.sender_type === 'system') {
            return <div key={m.id} className="text-center"><span className="text-[11px] text-label-3 bg-[rgba(60,60,67,0.05)] rounded-full px-3 py-1">{m.content}</span></div>;
          }
          const mine = m.sender_type === selfType || (selfType === 'borrower' && m.sender_type === 'coborrower') || (selfType === 'coborrower' && m.sender_type === 'borrower');
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-medium text-label">{label(m.sender_type)}</span>
                <span className="text-[10px] text-label-3">{time(m.created_at)}</span>
              </div>
              <div className="max-w-[80%] text-[13px] leading-relaxed rounded-[12px] px-3.5 py-2 whitespace-pre-wrap text-label" style={{ background: mine ? `${accent}22` : 'rgba(60,60,67,0.05)' }}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t border-[rgba(60,60,67,0.08)] p-3">
        {err && <p className="text-[11px] text-red-600 mb-1.5">{err}</p>}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            className="flex-1 text-[13px] bg-[rgba(60,60,67,0.05)] rounded-[10px] px-3 py-2.5 focus:outline-none"
          />
          <button onClick={send} disabled={sending || !input.trim()} className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white disabled:opacity-40" style={{ background: accent }}>
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
