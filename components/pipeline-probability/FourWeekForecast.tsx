'use client';

// Phase 83 — 4-week weighted capacity forecast. Recharts bar chart, collapsible.
// Current week bar in gold; informational (no per-bar navigation to avoid a no-op).

import { useState } from 'react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { IconChevronDown, IconChevronRight, IconChartBar } from '@tabler/icons-react';
import type { WeekBucket } from '@/lib/pipeline-probability/forecast';

const fmtUsd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;

export function FourWeekForecast({ data }: { data: WeekBucket[] }) {
  const [open, setOpen] = useState(true);
  const total = data.reduce((s, w) => s + w.weighted_value, 0);
  const totalLoans = data.reduce((s, w) => s + w.loan_count, 0);

  if (totalLoans === 0) return null; // nothing closing in the next 4 weeks

  return (
    <section className="bg-white border border-[var(--color-border-tertiary)] rounded-[12px] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#fdfbf7] transition-colors"
      >
        <IconChartBar size={15} className="text-[var(--c-gold-deep)]" />
        <span className="text-[13px] font-semibold text-black">4-week forecast</span>
        <span className="ml-auto text-[12px] text-[var(--color-text-secondary)]">
          <span className="font-medium text-[#8A6310]">{fmtUsd(total)}</span> weighted · {totalLoans} loans
        </span>
        {open ? (
          <IconChevronDown size={15} className="text-[var(--color-text-secondary)]" />
        ) : (
          <IconChevronRight size={15} className="text-[var(--color-text-secondary)]" />
        )}
      </button>

      {open && (
        <div className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <XAxis
                dataKey="week_label"
                tick={{ fontSize: 11, fill: '#86868B' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(201,169,92,0.06)' }}
                formatter={(v: number) => [fmtUsd(v), 'Weighted']}
                labelFormatter={(l) => `Week of ${l}`}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
              <Bar dataKey="weighted_value" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#C9A95C' : '#D8D4C8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
