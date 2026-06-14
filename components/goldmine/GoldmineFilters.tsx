'use client';

import type { GoldmineSignalType } from '@/lib/goldmine/types';

export type SignalFilter = 'all' | GoldmineSignalType;

const FILTERS: { key: SignalFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'rate_improvement', label: 'Rate Refi' },
  { key: 'equity_milestone', label: 'Equity' },
  { key: 'pre_approval_expired', label: 'Pre-Approval' },
  { key: 'loan_anniversary', label: 'Anniversary' },
  { key: 'long_inactive', label: 'Inactive' },
];

export function GoldmineFilters({ value, onChange, counts }: { value: SignalFilter; onChange: (f: SignalFilter) => void; counts: Record<string, number> }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {FILTERS.map((f) => {
        const n = f.key === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[f.key] ?? 0;
        const active = value === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onChange(f.key)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${active ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#4A4A4A] border-[#E8E4DE] hover:bg-[#FAFAF8]'}`}
          >
            {f.label}
            {n > 0 && <span className={`ml-1.5 ${active ? 'text-white/60' : 'text-[#6B7B8D]'}`}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
