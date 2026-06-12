/**
 * Phase 99 — bottleneck detection. PURE (ported verbatim from the spec).
 */
interface StageWithConversion {
  name: string;
  conversion_pct: number | null;
}

/**
 * Stage with the lowest conversion_pct. Excludes the final stage (no next stage)
 * and any stage with null conversion (insufficient data). null if none eligible.
 */
export function detectBottleneck(stages: StageWithConversion[]): string | null {
  const withConversion = stages.slice(0, -1).filter((s) => s.conversion_pct !== null);
  if (!withConversion.length) return null;
  return withConversion.reduce((worst, stage) =>
    (stage.conversion_pct as number) < (worst.conversion_pct as number) ? stage : worst,
  ).name;
}
