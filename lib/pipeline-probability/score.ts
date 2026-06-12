// Phase 83 — close-probability scoring (PURE, testable). 6 weighted factors per the spec,
// adapted to the real schema:
//   - days_in_stage derived from stage_changed_at
//   - conditions = uncleared loan_conditions count
//   - ghost penalty driven by borrower_behavior_scores DISENGAGEMENT (tier ghost/at_risk),
//     since our behavior `score` is 0-100 ENGAGEMENT (higher = better), the inverse of the
//     spec's 0-10 ghost_score
//   - TRID = business days until the nearest le/cd deadline
//   - responsiveness = borrower_behavior_scores.avg_response_hours

export type DrivingFactor = {
  factor: string;
  weight: number; // points contributed (+/-)
  impact: 'positive' | 'negative';
};

export type ProbabilityResult = {
  score: number; // 0-100
  confidence: 'high' | 'medium' | 'low';
  driving_factors: DrivingFactor[];
};

export type ProbabilityInput = {
  stage: string;
  days_in_stage: number;
  conditions_outstanding: number;
  /** disengagement band from borrower_behavior_scores.tier */
  behavior_tier: string | null;
  /** business days until the nearest TRID (le/cd) deadline; null if none */
  trid_business_days_remaining: number | null;
  /** borrower_behavior_scores.avg_response_hours; null if unknown */
  avg_response_hours: number | null;
};

const STAGE_SCORES: Record<string, number> = {
  new_inquiry: 15,
  inquiry: 15,
  pre_qual: 25,
  application: 35,
  processing: 40,
  underwriting: 55,
  conditional_approval: 70,
  clear_to_close: 90,
  closed: 100,
  funded: 100,
};

const DISENGAGED_TIERS = new Set(['ghost', 'at_risk']);

export function calculateCloseProbability(input: ProbabilityInput): ProbabilityResult {
  const base = STAGE_SCORES[input.stage] ?? 20;
  let score = base;
  const factors: DrivingFactor[] = [{ factor: 'stage', weight: base, impact: 'positive' }];

  // Days-in-stage penalty: -5 per week beyond 14 days, capped at -20.
  const weeksInStage = Math.floor((input.days_in_stage ?? 0) / 7);
  if (weeksInStage > 2) {
    const penalty = Math.min((weeksInStage - 2) * 5, 20);
    score -= penalty;
    factors.push({ factor: 'days_in_stage', weight: -penalty, impact: 'negative' });
  }

  // Outstanding conditions: -3 each, capped at -15.
  if (input.conditions_outstanding > 0) {
    const penalty = Math.min(input.conditions_outstanding * 3, 15);
    score -= penalty;
    factors.push({ factor: 'conditions_outstanding', weight: -penalty, impact: 'negative' });
  }

  // Ghost / disengaged borrower: -15.
  if (input.behavior_tier && DISENGAGED_TIERS.has(input.behavior_tier)) {
    score -= 15;
    factors.push({ factor: 'ghost_risk', weight: -15, impact: 'negative' });
  }

  // TRID deadline risk: nearest deadline within 1 business day: -20.
  if (input.trid_business_days_remaining !== null && input.trid_business_days_remaining <= 1) {
    score -= 20;
    factors.push({ factor: 'trid_deadline', weight: -20, impact: 'negative' });
  }

  // Borrower responsiveness bonus: replies within 24h: +5.
  if (input.avg_response_hours !== null && input.avg_response_hours <= 24) {
    score += 5;
    factors.push({ factor: 'borrower_responsiveness', weight: 5, impact: 'positive' });
  }

  score = Math.max(0, Math.min(100, score));
  const confidence: ProbabilityResult['confidence'] = score > 75 ? 'high' : score >= 40 ? 'medium' : 'low';

  // Most impactful factors first (by absolute weight), keep top 4.
  const driving_factors = [...factors]
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 4);

  return { score, confidence, driving_factors };
}

/** Whole business days (Mon–Fri) from today until `deadline`. Negative if past. null if no date. */
export function businessDaysUntil(deadline: string | null, now = new Date()): number | null {
  if (!deadline) return null;
  const end = new Date(deadline);
  if (Number.isNaN(end.getTime())) return null;
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const past = b < a;
  const [from, to] = past ? [b, a] : [a, b];
  let count = 0;
  const cur = new Date(from);
  while (cur < to) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return past ? -count : count;
}
