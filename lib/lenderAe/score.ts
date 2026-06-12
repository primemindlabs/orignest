// Phase 89 — PURE AE performance score (0–100). No I/O. Rewards fast responders,
// preferred relationships, reachability (cell on file), and recent activity.

export interface AEScoreInput {
  response_time_avg_hours: number | null;
  preferred: boolean;
  ae_cell: string | null;
  last_submission_at: string | null;
  /** Injected for testability; defaults to now. */
  now?: number;
}

export function aePerformanceScore(ae: AEScoreInput): number {
  let score = 0;

  const hrs = ae.response_time_avg_hours;
  if (hrs !== null && hrs !== undefined) {
    score += hrs < 2 ? 40 : hrs < 4 ? 30 : hrs < 8 ? 20 : hrs < 24 ? 10 : 0;
  }
  if (ae.preferred) score += 20;
  if (ae.ae_cell) score += 10;
  if (ae.last_submission_at) {
    const now = ae.now ?? Date.now();
    const days = (now - new Date(ae.last_submission_at).getTime()) / 86_400_000;
    if (days < 90) score += 30;
  }
  return Math.min(100, score);
}

/** Tier label + token color key for the score bar. */
export function scoreTier(score: number): { label: string; tone: 'gold' | 'good' | 'ok' | 'low' } {
  if (score >= 80) return { label: 'Top AE', tone: 'gold' };
  if (score >= 55) return { label: 'Solid', tone: 'good' };
  if (score >= 30) return { label: 'Active', tone: 'ok' };
  return { label: 'New / quiet', tone: 'low' };
}

export const LOAN_TYPE_OPTIONS = [
  'conventional', 'fha', 'va', 'usda', 'jumbo', 'dscr', 'non_qm', 'heloc', 'construction', 'reverse', 'commercial',
] as const;
