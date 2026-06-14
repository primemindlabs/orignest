import type { BenchmarkRow } from '@/lib/businessPulse/benchmarks';

function rank(row: BenchmarkRow): { label: string; color: string } | null {
  if (row.yours == null) return null;
  const beatsTop = row.lowerIsBetter ? row.yours <= row.topQuartile : row.yours >= row.topQuartile;
  const beatsMedian = row.lowerIsBetter ? row.yours <= row.median : row.yours >= row.median;
  if (beatsTop) return { label: 'Top quartile', color: '#1A7A45' };
  if (beatsMedian) return { label: 'Above median', color: '#C9A95C' };
  return { label: 'Below median', color: '#C4724A' };
}

const fmt = (v: number | null, unit: string) => (v == null ? '—' : `${v}${unit === '%' ? '%' : unit === 'days' ? ' days' : ''}`);

export function PulseBenchmarkTable({ rows }: { rows: BenchmarkRow[] }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E4DE] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#F0EDE8]">
        <p className="text-sm font-semibold text-[#1A1A1A]">Benchmarks</p>
        <p className="text-xs text-[#6B7B8D] mt-0.5">Your branch vs. industry (anonymized aggregates)</p>
      </div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 px-5 py-2.5 text-[10px] font-medium text-[#6B7B8D] uppercase tracking-wide border-b border-[#F0EDE8]">
        <div>Metric</div>
        <div className="text-right">Your Branch</div>
        <div className="text-right">Median</div>
        <div className="text-right">Top Quartile</div>
      </div>
      <div className="divide-y divide-[#F4F2EF]">
        {rows.map((row) => {
          const r = rank(row);
          return (
            <div key={row.label} className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 px-5 py-3 text-sm items-center">
              <div className="text-[#1A1A1A]">{row.label}</div>
              <div className="text-right font-semibold" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace', color: r?.color ?? '#1A1A1A' }}>
                {fmt(row.yours, row.unit)}
                {r && <span className="block text-[10px] font-normal" style={{ color: r.color }}>{r.label}</span>}
              </div>
              <div className="text-right text-[#6B7B8D]" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace' }}>{fmt(row.median, row.unit)}</div>
              <div className="text-right text-[#6B7B8D]" style={{ fontFamily: 'var(--font-dm-mono), DM Mono, monospace' }}>{fmt(row.topQuartile, row.unit)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
