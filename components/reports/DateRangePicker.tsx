'use client';

import { useState, useRef, useEffect } from 'react';
import { IconCalendar, IconChevronDown } from '@tabler/icons-react';
import type { RangePreset } from '@/lib/reports/compute';

const OPTIONS: { key: RangePreset; label: string }[] = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'q1', label: 'Q1' },
  { key: 'q2', label: 'Q2' },
  { key: 'q3', label: 'Q3' },
  { key: 'q4', label: 'Q4' },
  { key: 'ytd', label: 'Year to date' },
];

export function DateRangePicker({ value, onChange }: { value: RangePreset; onChange: (p: RangePreset) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.key === value)?.label ?? 'This month';

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }} className="no-print">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium border border-border text-black bg-surface hover:bg-fill transition-colors"
      >
        <IconCalendar size={14} className="text-[#8A6310]" /> {current} <IconChevronDown size={12} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', width: 160, zIndex: 40, background: '#fff', borderRadius: 10, border: '0.5px solid rgba(0,0,0,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', padding: '4px 0' }}>
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => { onChange(o.key); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 13, background: o.key === value ? '#fdf8ee' : 'transparent', color: o.key === value ? '#8A6310' : '#1D1D1F', fontWeight: o.key === value ? 500 : 400, cursor: 'pointer' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
