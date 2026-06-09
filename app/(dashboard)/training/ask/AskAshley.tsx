'use client';

/** Phase 30.10 — Ask Ashley guideline chat (Claude Sonnet). */
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Send, Sparkles } from 'lucide-react';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const CHIPS = ['FHA MIP rates', 'VA funding fee', 'FNMA DTI limit', 'Self-employed income calculation'];

export function AskAshley() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/ai/ask-ashley', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: res.ok ? data.reply || '…' : data.error ?? 'Something went wrong.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Network error — please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--c-gold-light)] flex items-center justify-center">
              <Sparkles size={18} className="text-[var(--c-gold-deep)]" />
            </div>
            <p className="text-[13px] text-[var(--c-label2)] max-w-sm">
              Ask about FNMA, FHLMC, FHA, VA, or USDA guidelines. Ashley cites the reference and walks through scenarios.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {CHIPS.map((c) => (
                <button key={c} onClick={() => send(c)} className="text-[12px] px-3 py-1.5 rounded-full border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)]">
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] text-[13px] leading-relaxed rounded-[12px] px-3.5 py-2.5 whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-[var(--c-gold-light)] text-[var(--c-text)]' : 'bg-[var(--c-fill)] text-[var(--c-text)]'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-[12px] text-[var(--c-label2)]">Ashley is thinking…</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-[var(--c-border)] p-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a guideline question…"
          className="flex-1 text-[13px] bg-[var(--c-fill)] rounded-[10px] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          <Send size={14} />
        </Button>
      </form>
    </div>
  );
}
