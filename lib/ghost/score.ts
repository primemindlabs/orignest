// Phase 85 — borrower ghost score (PURE, testable). 0–10 from 5 engagement signals,
// each worth +2. Signals are nullable: a signal we cannot measure adds nothing (we never
// fabricate disengagement from missing data). Distinct from borrower_behavior_scores
// (0–100 engagement) — this is the spec's 0–10 ghost scale.

export type GhostBand = 'engaged' | 'cooling' | 'at_risk' | 'ghost';

export type GhostSignals = {
  daysSinceEmailOpen: number | null;
  daysSinceReply: number | null;
  daysSincePortalLogin: number | null;
  missedCalls: number | null;
  daysSinceContact: number | null;
};

export type GhostScoreResult = {
  score: number; // 0–10
  band: GhostBand;
  components: Record<string, number>;
  measured: string[]; // which signals had data (for honesty in the UI)
};

export function bandForScore(score: number): GhostBand {
  if (score <= 2) return 'engaged';
  if (score <= 4) return 'cooling';
  if (score <= 7) return 'at_risk';
  return 'ghost';
}

export function computeGhostScore(signals: GhostSignals): GhostScoreResult {
  let score = 0;
  const components: Record<string, number> = {};
  const measured: string[] = [];

  const add = (key: string, value: number | null, threshold: number) => {
    if (value === null || value === undefined) return;
    measured.push(key);
    if (value >= threshold) {
      score += 2;
      components[key] = 2;
    }
  };

  add('email_open', signals.daysSinceEmailOpen, 5);
  add('reply', signals.daysSinceReply, 3);
  add('portal_login', signals.daysSincePortalLogin, 7);
  add('missed_calls', signals.missedCalls, 2);
  add('last_contact', signals.daysSinceContact, 10);

  score = Math.min(10, score);
  return { score, band: bandForScore(score), components, measured };
}

export const BAND_LABEL: Record<GhostBand, string> = {
  engaged: 'Engaged',
  cooling: 'Cooling',
  at_risk: 'At risk',
  ghost: 'Ghost',
};
