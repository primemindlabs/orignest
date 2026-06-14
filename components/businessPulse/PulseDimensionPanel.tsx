'use client';

import { useState } from 'react';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';

export type DimRow = { label: string; value: string };
export type DimList = { label: string; items: string[] };

type Props = {
  label: string;
  weight: string;
  score: number | null;
  rows: DimRow[];
  lists?: DimList[];
};

function color(n: number | null): string {
  const v = n ?? 0;
  return v >= 75 ? '#1A7A45' : v >= 50 ? '#C9A95C' : '#C4724A';
}

export function PulseDimensionPanel({ label, weight, score, rows, lists }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-[#E8E4DE] overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAF8]">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#1A1A1A]">{label}</span>
          <span className="text-[10px] text-[#6B7B8D] uppercase tracking-wide">{weight}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace', color: color(score) }}>
            {score ?? '—'}
          </span>
          {open ? <IconChevronUp size={16} className="text-[#6B7B8D]" /> : <IconChevronDown size={16} className="text-[#6B7B8D]" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-1 border-t border-[#F0EDE8] space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pt-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-[#6B7B8D]">{r.label}</span>
                <span className="text-[#1A1A1A] font-medium" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace' }}>{r.value}</span>
              </div>
            ))}
          </div>
          {(lists ?? []).filter((l) => l.items.length > 0).map((l) => (
            <div key={l.label}>
              <p className="text-xs font-medium text-[#6B7B8D] uppercase tracking-wide mb-1.5">{l.label}</p>
              <ul className="space-y-1">
                {l.items.map((item, i) => (
                  <li key={i} className="text-sm text-[#4A4A4A] flex items-start gap-1.5">
                    <span className="text-[#C4724A]">•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
