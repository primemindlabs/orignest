'use client';

type Period = 30 | 60 | 90 | 180;
const PERIODS: { value: Period; label: string }[] = [
  { value: 30, label: '30d' }, { value: 60, label: '60d' }, { value: 90, label: '90d' }, { value: 180, label: '180d' },
];

export function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${value === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
