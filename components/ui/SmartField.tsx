'use client';

/**
 * Phase 28.3 — SmartField
 *
 * A computed-or-manual field. Shows an [Auto] badge when the value is calculated
 * and a [Manual] badge once overridden. The badge tooltip reveals the formula.
 * Used by every computed field in DTI, CD Balancer, and income analysis; plain
 * manual fields keep using <Input>, so the distinction is always visually clear.
 */
import { useState } from 'react';
import { Sparkles, Pencil, RotateCcw } from 'lucide-react';

export interface SmartFieldProps {
  label: string;
  value: number | string;
  isAutoCalculated: boolean;
  formula?: string;
  onOverride: (val: number | string) => void;
  onClearOverride: () => void;
  format?: 'currency' | 'percent' | 'integer' | 'text';
}

function display(value: number | string, format: SmartFieldProps['format']): string {
  if (value === '' || value == null) return '—';
  if (format === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value));
  if (format === 'percent') return `${value}%`;
  if (format === 'integer') return new Intl.NumberFormat('en-US').format(Number(value));
  return String(value);
}

export function SmartField({
  label,
  value,
  isAutoCalculated,
  formula,
  onOverride,
  onClearOverride,
  format = 'text',
}: SmartFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [showTip, setShowTip] = useState(false);

  function commit() {
    const next = format === 'text' ? draft : Number(draft);
    onOverride(next);
    setEditing(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[13px] font-medium text-[var(--c-text)]">{label}</label>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            onClick={() => setEditing(true)}
            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors ${
              isAutoCalculated
                ? 'bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]'
                : 'bg-[var(--c-fill)] text-[var(--c-label2)]'
            }`}
          >
            {isAutoCalculated ? <Sparkles size={10} /> : <Pencil size={10} />}
            {isAutoCalculated ? 'Auto' : 'Manual'}
          </button>
          {showTip && formula && (
            <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-[8px] bg-[var(--c-text)] text-white text-[11px] leading-snug px-2.5 py-2 shadow-lg">
              {isAutoCalculated ? `Calculated from: ${formula}. Click to override.` : 'Manually overridden. Clear to recalculate.'}
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            type={format === 'text' ? 'text' : 'number'}
            className="w-full h-9 rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 text-[14px] text-[var(--c-text)] focus:outline-none focus:ring-2 focus:ring-[var(--c-gold)]/30"
          />
          <button type="button" onClick={commit} className="h-9 px-3 rounded-[10px] bg-[var(--c-gold)] text-white text-[13px] font-medium">
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 h-9 rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface2)] px-3">
          <span className="text-[14px] font-mono tabular-nums text-[var(--c-text)]">{display(value, format)}</span>
          {!isAutoCalculated && (
            <button
              type="button"
              onClick={onClearOverride}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--c-label2)] hover:text-[var(--c-text)]"
              title="Clear override and recalculate"
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
