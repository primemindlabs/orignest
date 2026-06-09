/**
 * Phase 29.3/29.4b — Pure-SVG equity chart (no chart library).
 * Shows total value (light gold), balance (navy), equity gap filled gold.
 */
export interface SnapshotPoint { date: string; avm: number; balance: number; equity: number }

const usdK = (n: number) => `$${Math.round(n / 1000)}K`;

export function EquityChart({ points }: { points: SnapshotPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
        <p className="text-[13px] text-[var(--c-label2)]">Equity history builds weekly. A trend line appears after a few snapshots.</p>
      </div>
    );
  }

  const W = 640, H = 220, padX = 8, padTop = 12, padBottom = 24;
  const maxVal = Math.max(...points.map((p) => p.avm), 1);
  const n = points.length;
  const x = (i: number) => padX + (i / (n - 1)) * (W - padX * 2);
  const y = (v: number) => padTop + (1 - v / maxVal) * (H - padTop - padBottom);

  const line = (sel: (p: SnapshotPoint) => number) => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(sel(p)).toFixed(1)}`).join(' ');
  const avmLine = line((p) => p.avm);
  const balLine = line((p) => p.balance);
  // Equity band = area between avm and balance.
  const band = `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.avm).toFixed(1)}`).join(' ')} ${points.slice().reverse().map((p, ri) => { const i = n - 1 - ri; return `L ${x(i).toFixed(1)} ${y(p.balance).toFixed(1)}`; }).join(' ')} Z`;

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 220 }}>
        <path d={band} fill="var(--c-gold)" fillOpacity={0.18} />
        <path d={avmLine} fill="none" stroke="var(--c-gold)" strokeWidth={2} />
        <path d={balLine} fill="none" stroke="var(--c-text)" strokeWidth={2} strokeOpacity={0.55} />
      </svg>
      <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--c-label3)]">
        <span>{new Date(points[0].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[var(--c-gold)] inline-block" /> Value</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-0.5 inline-block" style={{ backgroundColor: 'var(--c-text)', opacity: 0.55 }} /> Balance</span>
          <span className="text-[var(--c-gold-deep)] font-medium">Equity {usdK(points[points.length - 1].equity)}</span>
        </span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
      </div>
    </div>
  );
}
