'use client';

// Phase 82 — Loan File AI. Right-docked collapsible drawer on the loan-file shell.
// Auto-opens when the URL has ?focus=ai (e.g. from the Morning Brief "Open loan" action).
// Answers come strictly from this loan's data, with a required source citation.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  IconSparkles,
  IconDatabase,
  IconX,
  IconArrowUp,
  IconLoader2,
} from '@tabler/icons-react';
import type { LoanAIQueryLog } from '@/lib/loan-ai/types';

const SUGGESTIONS = [
  'When does the rate lock expire?',
  'What conditions are still outstanding?',
  'What is the DTI on this loan?',
  'When is the closing date?',
];

export function LoanFileAIPanel({ loanId }: { loanId: string }) {
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get('focus') === 'ai');

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed top-1/2 right-0 -translate-y-1/2 z-50 flex items-center gap-1.5 h-10 pl-3 pr-3.5 rounded-l-[12px] bg-[var(--c-gold)] text-white shadow-lg hover:brightness-105 transition"
        aria-label="Ask Ashley about this loan"
      >
        <IconSparkles size={16} />
        <span className="text-[12px] font-semibold">Ask Ashley</span>
      </button>
    );
  }

  return <Drawer loanId={loanId} onClose={() => setOpen(false)} />;
}

function Drawer({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<LoanAIQueryLog[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch(`/api/loans/${loanId}/ai-query/history`);
      const d = (await r.json()) as { queries?: LoanAIQueryLog[] };
      setHistory(d.queries ?? []);
    } catch {
      /* ignore */
    }
  }, [loanId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const ask = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || isLoading) return;
    setIsLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    try {
      const res = await fetch(`/api/loans/${loanId}/ai-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
      } else {
        setAnswer(data.answer);
        setSources(data.sources ?? []);
        setQuestion('');
        loadHistory();
      }
    } catch {
      setError('Could not reach Ashley. Try again shortly.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <aside className="fixed top-0 right-0 h-screen w-[min(380px,90vw)] z-50 flex flex-col bg-[var(--c-surface)] border-l border-[var(--c-border)] shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-[var(--c-border)] flex-shrink-0">
        <IconSparkles size={16} className="text-[var(--c-gold-deep)]" />
        <span className="text-[13px] font-semibold text-[var(--c-text)]">Ask Ashley about this loan</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-auto h-7 w-7 grid place-items-center rounded-[8px] text-[var(--c-label3)] hover:text-[var(--c-text)] hover:bg-[rgba(60,60,67,0.06)] transition-colors"
        >
          <IconX size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Answer */}
        {isLoading && (
          <div className="flex items-center gap-2 text-[13px] text-[var(--c-label2)]">
            <IconLoader2 size={15} className="animate-spin" /> Reading this loan file…
          </div>
        )}
        {error && (
          <div className="text-[13px] text-[var(--c-danger)] bg-[rgba(196,114,74,0.08)] rounded-[10px] p-3">{error}</div>
        )}
        {answer && !isLoading && <AIAnswerCard answer={answer} sources={sources} />}

        {/* Suggestions (before first question) */}
        {!answer && !isLoading && !error && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-[var(--c-label3)] uppercase tracking-wide">Try asking</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="block w-full text-left text-[13px] text-[var(--c-text)] bg-[rgba(60,60,67,0.04)] hover:bg-[rgba(60,60,67,0.08)] rounded-[10px] px-3 py-2 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-medium text-[var(--c-label3)] uppercase tracking-wide">Recent questions</p>
            {history.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  setAnswer(h.answer);
                  setSources(h.sources ?? []);
                  setError(null);
                }}
                className="block w-full text-left text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)] truncate transition-colors"
                title={h.question}
              >
                {h.question}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--c-border)] p-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(question);
              }
            }}
            rows={1}
            placeholder="Ask about this loan…"
            className="flex-1 resize-none text-[13px] text-[var(--c-text)] bg-[rgba(60,60,67,0.05)] rounded-[10px] px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--c-gold)] max-h-28"
          />
          <button
            onClick={() => ask(question)}
            disabled={!question.trim() || isLoading}
            aria-label="Ask"
            className="h-9 w-9 grid place-items-center rounded-[10px] bg-[var(--c-gold)] text-white disabled:opacity-40 hover:brightness-105 transition flex-shrink-0"
          >
            {isLoading ? <IconLoader2 size={16} className="animate-spin" /> : <IconArrowUp size={16} />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--c-label3)]">Answers use only this loan file's data.</p>
      </div>
    </aside>
  );
}

function AIAnswerCard({ answer, sources }: { answer: string; sources: string[] }) {
  // The model appends a "Source: …" line; show it as chips instead of raw text.
  const body = answer.replace(/\n?Source:\s*.+\s*$/im, '').trim();
  return (
    <div className="bg-[rgba(201,169,92,0.06)] border border-[var(--c-border)] rounded-[12px] p-3">
      <p className="text-[13px] text-[var(--c-text)] leading-relaxed whitespace-pre-wrap">{body}</p>
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {sources.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--c-gold-deep)] bg-[rgba(201,169,92,0.12)] rounded-full px-2 py-0.5"
            >
              <IconDatabase size={11} />
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
