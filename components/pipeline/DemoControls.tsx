'use client';

/** Phase 42.4 — Demo Mode controls: seed a sample pipeline when empty, or a
 * dismissible banner + clear button when demo data is present. */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X } from 'lucide-react';

export function DemoControls({ leadCount, demoCount }: { leadCount: number; demoCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function seed() {
    setBusy(true);
    try { await fetch('/api/demo/seed', { method: 'POST' }); router.refresh(); } finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true);
    try { await fetch('/api/demo/clear', { method: 'POST' }); router.refresh(); } finally { setBusy(false); }
  }

  if (demoCount > 0) {
    return (
      <div className="flex items-center gap-3 rounded-[12px] border border-[var(--c-gold)]/40 bg-[var(--c-gold-light)] px-4 py-2.5">
        <Sparkles size={15} className="text-[var(--c-gold-deep)] flex-shrink-0" />
        <p className="text-[12px] text-[var(--c-text)] flex-1">These are <strong>sample loans</strong> so you can see the pipeline full. They&apos;re excluded from billing and reports.</p>
        <button onClick={clear} disabled={busy} className="text-[12px] font-medium text-[var(--c-gold-deep)] hover:underline inline-flex items-center gap-1 flex-shrink-0"><X size={12} /> {busy ? 'Clearing…' : 'Clear demo data'}</button>
      </div>
    );
  }

  if (leadCount === 0) {
    return (
      <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-6 text-center">
        <Sparkles size={22} className="text-[var(--c-gold-deep)] mx-auto mb-2" />
        <p className="text-[14px] font-semibold text-[var(--c-text)]">See what a full pipeline looks like</p>
        <p className="text-[12px] text-[var(--c-label2)] mt-0.5 mb-3">Load 6 sample loans across every stage. Clear them anytime — they never touch your billing.</p>
        <button onClick={seed} disabled={busy} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-[var(--c-gold)] text-white hover:opacity-90 transition-opacity disabled:opacity-60"><Sparkles size={14} /> {busy ? 'Loading…' : 'Load sample pipeline'}</button>
      </div>
    );
  }

  return null;
}
