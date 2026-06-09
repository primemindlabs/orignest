'use client';

/**
 * Phase 31.1 — LO 3-way chat. Live updates via lightweight polling (the app uses
 * Clerk, not Supabase auth, so RLS-filtered Realtime isn't available client-side).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Send, Home, UserPlus, AlertTriangle, Shield } from 'lucide-react';
import { detectFinancialContent } from '@/lib/chat/financialGuard';

interface Msg {
  id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  content_type: string;
  visible_to: string[];
  created_at: string;
}
interface Participants {
  lo: string;
  borrower: string;
  realtor: string | null;
}
interface ThreadState {
  id: string;
  realtor_in_thread: boolean;
  coborrower_in_thread: boolean;
}

type Audience = 'everyone' | 'borrower' | 'realtor';
const AUDIENCE_VISIBLE: Record<Audience, string[]> = {
  everyone: ['lo', 'borrower', 'coborrower', 'realtor'],
  borrower: ['lo', 'borrower', 'coborrower'],
  realtor: ['lo', 'realtor'],
};

function time(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function LoanChat({ loanId }: { loanId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [participants, setParticipants] = useState<Participants>({ lo: 'Loan Officer', borrower: 'Borrower', realtor: null });
  const [thread, setThread] = useState<ThreadState | null>(null);
  const [input, setInput] = useState('');
  const [audience, setAudience] = useState<Audience>('everyone');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/loans/${loanId}/chat`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages ?? []);
    setParticipants(data.participants ?? participants);
    setThread(data.thread ?? null);
  }, [loanId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const realtorWarning = audience === 'realtor' && detectFinancialContent(input);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, visible_to: AUDIENCE_VISIBLE[audience] }),
      });
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

  async function addRealtor() {
    // Find an approved realtor portal for this loan and add them.
    const res = await fetch(`/api/loans/${loanId}/chat/add-participant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participant_type: 'realtor', auto: true }),
    });
    if (res.ok) load();
    else {
      const d = await res.json();
      setErr(d.error ?? 'Add a realtor to this loan first (Realtor Access).');
    }
  }

  function label(m: Msg) {
    switch (m.sender_type) {
      case 'lo': return `${participants.lo} (LO)`;
      case 'borrower': return participants.borrower;
      case 'coborrower': return 'Co-Borrower';
      case 'realtor': return `${participants.realtor ?? 'Realtor'} (Realtor)`;
      case 'system': return 'SYSTEM';
      default: return m.sender_type;
    }
  }
  function visTag(m: Msg) {
    if (m.sender_type === 'system') return null;
    if (!m.visible_to.includes('borrower') && m.visible_to.includes('realtor')) return 'Realtor only';
    if (!m.visible_to.includes('realtor') && m.visible_to.includes('borrower')) return 'Borrower only';
    return 'Everyone';
  }

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] flex flex-col h-[68vh]">
      {/* Participants */}
      <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[12px] bg-[var(--c-fill)] rounded-full px-2.5 py-1 text-[var(--c-text)]">
          {participants.borrower} ✓
        </span>
        {participants.realtor ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] bg-[var(--c-gold-light)] rounded-full px-2.5 py-1 text-[var(--c-gold-deep)]">
            <Home size={11} /> {participants.realtor}
          </span>
        ) : (
          <button onClick={addRealtor} className="inline-flex items-center gap-1.5 text-[12px] border border-dashed border-[var(--c-border)] rounded-full px-2.5 py-1 text-[var(--c-label2)] hover:bg-[var(--c-fill)]">
            <UserPlus size={11} /> Add Realtor
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && <p className="text-[13px] text-[var(--c-label2)] text-center py-8">No messages yet. Say hello to your borrower.</p>}
        {messages.map((m) => {
          const mine = m.sender_type === 'lo';
          const system = m.sender_type === 'system';
          if (system) {
            return (
              <div key={m.id} className="text-center">
                <span className="text-[11px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-full px-3 py-1">{m.content}</span>
              </div>
            );
          }
          const tag = visTag(m);
          return (
            <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-medium text-[var(--c-text)]">{label(m)}</span>
                <span className="text-[10px] text-[var(--c-label2)]">{time(m.created_at)}</span>
                {tag && tag !== 'Everyone' && (
                  <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]">{tag}</span>
                )}
              </div>
              <div className={`max-w-[80%] text-[13px] leading-relaxed rounded-[12px] px-3.5 py-2 whitespace-pre-wrap ${mine ? 'bg-[var(--c-gold-light)] text-[var(--c-text)]' : 'bg-[var(--c-fill)] text-[var(--c-text)]'}`}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--c-border)] p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--c-label2)]">Send to:</span>
          {(['everyone', 'borrower', 'realtor'] as Audience[]).map((a) => (
            <button
              key={a}
              onClick={() => setAudience(a)}
              disabled={a === 'realtor' && !thread?.realtor_in_thread}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors disabled:opacity-40 ${audience === a ? 'border-[var(--c-gold)] bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'border-[var(--c-border)] text-[var(--c-label2)]'}`}
            >
              {a === 'everyone' ? 'Everyone' : a === 'borrower' ? 'Borrower only' : 'Realtor only'}
            </button>
          ))}
        </div>
        {realtorWarning && (
          <p className="text-[11px] text-[var(--c-danger)] flex items-center gap-1">
            <AlertTriangle size={12} /> This looks like financial info — it can&apos;t be sent to a realtor and will be blocked.
          </p>
        )}
        {audience === 'realtor' && !realtorWarning && (
          <p className="text-[11px] text-[var(--c-label2)] flex items-center gap-1">
            <Shield size={12} /> Realtor-only — financial details are blocked automatically.
          </p>
        )}
        {err && <p className="text-[11px] text-[var(--c-danger)]">{err}</p>}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message…"
            className="flex-1 text-[13px] bg-[var(--c-fill)] rounded-[10px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]"
          />
          <Button onClick={send} disabled={sending || !input.trim()}>
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
