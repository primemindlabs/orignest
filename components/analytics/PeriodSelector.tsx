'use client';

/** Phase 98 — 30/60/90/180-day period tabs. */
type Period = 30 | 60 | 90 | 180;
const PERIODS: Period[] = [30, 60, 90, 180];

export function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex items-center border-b border-gray-200">
      {PERIODS.map((p) => {
        const active = p === value;
        return (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'text-[#C9A95C] border-[#C9A95C]' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
          >
            {p}d
          </button>
        );
      })}
    </div>
  );
}
