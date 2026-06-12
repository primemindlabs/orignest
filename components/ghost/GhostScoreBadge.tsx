// Phase 85 — ghost score badge (0–10) color-coded by band.

import { IconGhost2 } from '@tabler/icons-react';
import type { GhostBand } from '@/lib/ghost/score';

export const BAND_COLOR: Record<GhostBand, string> = {
  engaged: 'var(--c-green)',
  cooling: 'var(--c-warning)',
  at_risk: '#D85A30',
  ghost: 'var(--c-danger)',
};

export function GhostScoreBadge({ score, band }: { score: number; band: GhostBand }) {
  const c = BAND_COLOR[band];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}
      title={`Ghost score ${score}/10 — ${band.replace('_', ' ')}`}
    >
      <IconGhost2 size={12} />
      {score}/10
    </span>
  );
}
