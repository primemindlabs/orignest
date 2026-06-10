'use client';

/** Phase 74 — money-bar cell: estimated commission with an inline-editable comp rate
 * (persists to the LO's profile). Uses Tabler icons + the --color-* token aliases. */
import { useState, useRef, useEffect } from 'react';
import { IconPencil, IconCheck } from '@tabler/icons-react';

export function PipelineCommissionMetric({ closingVolume, initialRate }: { closingVolume: number; initialRate: number }) {
  const [rate, setRate] = useState(initialRate);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialRate.toString());
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function commit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
      setRate(parsed);
      fetch('/api/profile/comp-rate', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rate: parsed }) }).catch(() => undefined);
    } else { setDraft(rate.toString()); }
    setEditing(false);
  }

  const commission = closingVolume * (rate / 100);
  return (
    <div className="px-5 py-4 border-r border-[var(--color-border-tertiary)]">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-xs text-[var(--color-text-secondary)]">Est. commission</p>
        {editing ? (
          <span className="flex items-center gap-1">
            <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(rate.toString()); setEditing(false); } }}
              className="w-12 h-5 text-xs px-1.5 rounded-[4px] border border-[#C9A95C] bg-[#C9A95C11] text-[#8A6310] focus:outline-none text-center" placeholder="0.50" />
            <span className="text-xs text-[#8A6310]">%</span>
            <button onClick={commit} className="text-[#8A6310]"><IconCheck size={12} /></button>
          </span>
        ) : (
          <button onClick={() => { setDraft(rate.toString()); setEditing(true); }} className="inline-flex items-center gap-1 text-[10px] font-medium text-[#8A6310] bg-[#C9A95C22] border border-[#C9A95C44] rounded-[4px] px-1.5 py-0.5 hover:bg-[#C9A95C33] transition-colors">
            <IconPencil size={9} /> {rate}%
          </button>
        )}
      </div>
      <p className="text-[19px] font-medium text-[#8A6310]">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(commission)}</p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">this month · tap % to edit</p>
    </div>
  );
}
