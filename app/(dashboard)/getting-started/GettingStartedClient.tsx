'use client';

/** Phase 36 — Getting Started checklist (persisted, auto-detected, dismissible). */
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Circle, ArrowRight, X } from 'lucide-react';

interface Step { key: string; label: string; description: string; href: string; done: boolean }

export function GettingStartedClient({ initial, completedCount, total }: { initial: Step[]; completedCount: number; total: number }) {
  const router = useRouter();
  const [steps, setSteps] = useState(initial);
  const [done, setDone] = useState(completedCount);
  const [dismissing, setDismissing] = useState(false);

  async function markDone(key: string) {
    setSteps((s) => s.map((x) => (x.key === key ? { ...x, done: true } : x)));
    setDone((d) => Math.min(total, d + 1));
    await fetch('/api/onboarding/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ step: key }) });
  }

  async function dismiss() {
    setDismissing(true);
    await fetch('/api/onboarding/dismiss', { method: 'POST' });
    router.push('/dashboard');
  }

  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-[var(--c-text)]">{done} of {total} complete</p>
          <button onClick={dismiss} disabled={dismissing} className="text-[12px] text-[var(--c-label2)] hover:text-[var(--c-text)] inline-flex items-center gap-1"><X size={12} /> Dismiss</button>
        </div>
        <div className="h-2 rounded-full bg-[var(--c-fill)] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--c-gold)' }} />
        </div>
      </div>

      <div className="space-y-2.5">
        {steps.map((s) => (
          <div key={s.key} className={`bg-[var(--c-surface)] border rounded-[12px] px-4 py-3 flex items-start gap-3 ${s.done ? 'border-[var(--c-border)]' : 'border-[var(--c-gold)]/40'}`}>
            {s.done ? (
              <div className="w-6 h-6 rounded-full bg-[var(--c-gold-light)] flex items-center justify-center flex-shrink-0 mt-0.5"><Check size={14} className="text-[var(--c-gold-deep)]" /></div>
            ) : (
              <Circle size={20} className="text-[var(--c-label3)] flex-shrink-0 mt-1" />
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] font-medium ${s.done ? 'text-[var(--c-label2)] line-through' : 'text-[var(--c-text)]'}`}>{s.label}</p>
              <p className="text-[12px] text-[var(--c-label2)]">{s.description}</p>
            </div>
            {!s.done && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => markDone(s.key)} className="text-[11px] text-[var(--c-label2)] hover:text-[var(--c-text)]">Mark done</button>
                <Link href={s.href} className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)] font-medium hover:underline">Do it <ArrowRight size={12} /></Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
