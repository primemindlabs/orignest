'use client';

/** Phase 30.9 — Smart Document Checklist (AI items marked with a gold sparkle). */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Sparkles, HelpCircle } from 'lucide-react';

export interface ChecklistItem {
  item: string;
  why: string;
  priority: 'required' | 'conditional' | 'nice_to_have';
  typical_turnaround_days: number;
}

const PRIORITY_META: Record<ChecklistItem['priority'], { label: string; color: string }> = {
  required: { label: 'Required', color: 'var(--c-danger)' },
  conditional: { label: 'Conditional', color: '#9a6a00' },
  nice_to_have: { label: 'Nice to have', color: 'var(--c-label2)' },
};

export function SmartChecklist({ loanId, initial }: { loanId: string; initial: ChecklistItem[] }) {
  const [items, setItems] = useState<ChecklistItem[]>(initial);
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/smart-checklist`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) setItems(data.items);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--c-label2)]">
          <Sparkles size={12} className="inline text-[var(--c-gold-deep)] mr-1" /> AI-generated for this loan profile
        </p>
        <Button variant="ghost" onClick={regenerate} disabled={busy}>
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> {busy ? 'Updating…' : 'Regenerate'}
        </Button>
      </div>

      {items.length === 0 && <p className="text-[13px] text-[var(--c-label2)] py-6 text-center">No checklist generated yet.</p>}

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden divide-y divide-[var(--c-border)]">
        {items.map((it, i) => {
          const meta = PRIORITY_META[it.priority];
          return (
            <div key={i} className="px-4 py-3 flex items-start gap-3">
              <Sparkles size={13} className="text-[var(--c-gold)] flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-medium text-[var(--c-text)]">{it.item}</p>
                  <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                  {it.typical_turnaround_days > 0 && (
                    <span className="text-[10px] text-[var(--c-label2)] font-mono tabular-nums">~{it.typical_turnaround_days}d</span>
                  )}
                </div>
                {it.why && (
                  <p className="text-[11px] text-[var(--c-label2)] mt-0.5 leading-snug flex items-start gap-1">
                    <HelpCircle size={11} className="flex-shrink-0 mt-0.5" /> {it.why}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
