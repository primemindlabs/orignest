'use client';

// Phase 83 — compact close-probability bar for pipeline rows.
// Color-coded fill + score% + top-2 driving signals; full factor list on hover (title).

import type { DrivingFactor } from '@/lib/pipeline-probability/score';

function color(score: number): string {
  if (score >= 75) return 'var(--c-green)';
  if (score >= 40) return 'var(--c-warning)';
  return 'var(--c-danger)';
}

const prettify = (f: string) => f.replace(/_/g, ' ');

export function CloseProbabilityBar({
  score,
  factors = [],
  compact = false,
}: {
  score: number;
  factors?: DrivingFactor[];
  compact?: boolean;
}) {
  const c = color(score);
  const top = factors.slice(0, 2).map((f) => prettify(f.factor)).join(' · ');
  const tooltip = factors
    .map((f) => `${prettify(f.factor)}: ${f.weight > 0 ? '+' : ''}${f.weight}`)
    .join('\n');

  return (
    <div className="min-w-0" title={tooltip || `Close probability ${score}%`}>
      <div className="flex items-center gap-1.5">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: `${c}22` }}>
          <div className="h-full rounded-full" style={{ width: `${score}%`, background: c }} />
        </div>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: c }}>
          {score}%
        </span>
      </div>
      {!compact && top && (
        <p className="text-[10px] text-[var(--c-label3)] truncate mt-0.5">{top}</p>
      )}
    </div>
  );
}
