/**
 * Phase 62.3 — ARM reset projections. PURE.
 * worst-case rate = current + lifetime cap. projected (first reset) = min(index +
 * margin, current + initial cap). Payment delta uses standard amortization over a
 * 360-month term on the current balance (estimate).
 */
export function monthlyPI(balance: number, annualRatePct: number, termMonths = 360): number {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return balance / termMonths;
  return (balance * r) / (1 - Math.pow(1 + r, -termMonths));
}

export interface ArmProjection { projected_rate: number; worst_case_rate: number; current_payment: number; projected_payment: number; payment_increase: number }

export function projectArmReset(p: { loan_balance: number; current_rate: number; arm_margin: number; arm_initial_cap: number; arm_lifetime_cap: number; index_rate: number; term_months?: number }): ArmProjection {
  const term = p.term_months ?? 360;
  const projectedRate = Math.min(p.index_rate + p.arm_margin, p.current_rate + p.arm_initial_cap);
  const worstCaseRate = p.current_rate + p.arm_lifetime_cap;
  const current = monthlyPI(p.loan_balance, p.current_rate, term);
  const projected = monthlyPI(p.loan_balance, projectedRate, term);
  return {
    projected_rate: Math.round(projectedRate * 1000) / 1000,
    worst_case_rate: Math.round(worstCaseRate * 1000) / 1000,
    current_payment: Math.round(current),
    projected_payment: Math.round(projected),
    payment_increase: Math.round(projected - current),
  };
}

export function daysToReset(firstResetDate: string, now = Date.now()): number {
  return Math.ceil((new Date(firstResetDate).getTime() - now) / 86_400_000);
}

export function resetUrgency(days: number): 'HIGH' | 'MEDIUM' | 'WATCH' | 'PAST' {
  if (days < 0) return 'PAST';
  if (days <= 30) return 'HIGH';
  if (days <= 60) return 'MEDIUM';
  return 'WATCH';
}

/** Conservative default index when no live SOFR/Treasury feed is connected. */
export const DEFAULT_INDEX_RATE = 4.3; // SOFR-ish fallback; gated index fetch overrides.
