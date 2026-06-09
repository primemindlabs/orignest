'use client';

/** Phase 51.6 — manager review of pending rate-exception requests (approve/deny). */
import { useState } from 'react';
import { Check, X } from 'lucide-react';

interface Exc { id: string; loan_type: string; loan_amount: number; exception_type: string; requested_rate: number | null; justification: string; broker?: string | null }

export function RateExceptionReview({ initial }: { initial: Exc[] }) {
  const [items, setItems] = useState<Exc[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, status: 'approved' | 'denied') {
    setBusy(id);
    try {
      const r = await fetch('/api/rate-exceptions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (r.ok) setItems((x) => x.filter((e) => e.id !== id));
    } finally { setBusy(null); }
  }

  if (items.length === 0) return <p className="text-[13px] text-[var(--c-label2)]">No rate exceptions pending review.</p>;

  return (
    <div className="space-y-2">
      {items.map((e) => (
        <div key={e.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--c-text)]">{e.exception_type.replace(/_/g, ' ')} · {e.loan_type} · ${(Number(e.loan_amount) / 1000).toFixed(0)}K{e.requested_rate ? ` → ${e.requested_rate}%` : ''}</p>
              <p className="text-[11px] text-[var(--c-label2)] mt-0.5">{e.broker ? `${e.broker} · ` : ''}{e.justification}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={() => decide(e.id, 'approved')} disabled={busy === e.id} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-btn text-[11px] font-medium bg-[var(--c-gold-light)] text-[var(--c-gold-deep)] hover:opacity-90"><Check size={12} /> Approve</button>
              <button onClick={() => decide(e.id, 'denied')} disabled={busy === e.id} className="inline-flex items-center gap-1 h-7 px-2.5 rounded-btn text-[11px] font-medium border border-[var(--c-border)] text-[var(--c-label2)] hover:text-[var(--c-danger)]"><X size={12} /> Deny</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
