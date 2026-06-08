'use client';

/**
 * Phase 4.2 — Borrower-side two-way messaging.
 * Fetch-based (the portal is token-auth'd, not Supabase-auth'd): loads on mount,
 * polls lightly, and refetches after sending.
 */
import { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  sender_type: 'borrower' | 'lo' | 'system';
  message: string;
  created_at: string;
}

export function PortalMessages({ token, loName }: { token: string; loName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch(`/api/borrower-portal/${token}/messages`);
      const json = await res.json();
      setMessages(json.messages ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000); // light poll
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/borrower-portal/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        setDraft('');
        await load();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-5">
      <h3 className="text-sm font-semibold text-black mb-3">Message {loName}</h3>

      <div className="max-h-72 overflow-y-auto space-y-2 mb-3">
        {loading ? (
          <div className="py-6 flex items-center justify-center gap-2 text-label-3">
            <Loader2 size={15} className="animate-spin" />
            <span className="text-sm">Loading messages…</span>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-label-3">
            No messages yet. Have a question? Send one below.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_type === 'borrower';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-card px-3.5 py-2 text-sm leading-snug ${
                    mine ? 'bg-navy text-white' : 'bg-fill text-black'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder="Type a message…"
          className="flex-1 px-3 py-2 rounded-[8px] bg-fill border border-border text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-gold/30 resize-none"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="h-10 w-10 flex items-center justify-center rounded-[8px] bg-navy text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          aria-label="Send message"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
