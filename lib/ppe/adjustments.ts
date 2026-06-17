// Phase 142 — PPE adjustment stack (PURE). Applies the LLPAs whose dimensions all
// match a scenario to a product's base price. Extends the P114 fico/ltv/purpose
// matcher with occupancy, property type, loan type, amortization, loan-amount band
// and lock period. A null bound on any axis = unconstrained (so older rows match).

import type { PricingScenario } from './types';

export interface AdjusterRow {
  adjuster_name: string;
  adjustment: number;
  fico_min: number | null;
  fico_max: number | null;
  ltv_min: number | null;
  ltv_max: number | null;
  loan_purpose: string | null;
  loan_type: string | null;
  occupancy: string | null;
  property_type: string | null;
  amort_type: string | null;
  min_loan_amount: number | null;
  max_loan_amount: number | null;
  lock_days: number | null;
}

function eqOrNull(constraint: string | null, value: string | null): boolean {
  if (!constraint) return true; // unconstrained
  if (!value) return true;      // scenario didn't specify — don't exclude
  return constraint.toLowerCase() === value.toLowerCase();
}

export function adjusterApplies(a: AdjusterRow, s: PricingScenario, amortizationType: string): boolean {
  if (a.fico_min != null && s.fico < a.fico_min) return false;
  if (a.fico_max != null && s.fico > a.fico_max) return false;
  if (a.ltv_min != null && s.ltv < a.ltv_min) return false;
  if (a.ltv_max != null && s.ltv > a.ltv_max) return false;
  if (a.min_loan_amount != null && s.loanAmount < Number(a.min_loan_amount)) return false;
  if (a.max_loan_amount != null && s.loanAmount > Number(a.max_loan_amount)) return false;
  if (a.lock_days != null && s.lockDays !== a.lock_days) return false;
  if (!eqOrNull(a.loan_purpose, s.loanPurpose)) return false;
  if (!eqOrNull(a.loan_type, s.loanType)) return false;
  if (!eqOrNull(a.occupancy, s.occupancy)) return false;
  if (!eqOrNull(a.property_type, s.propertyType)) return false;
  if (!eqOrNull(a.amort_type, amortizationType)) return false;
  return true;
}

export interface AdjustedPrice {
  basePrice: number;
  totalAdjustment: number;
  adjustedPrice: number;
  applied: { name: string; amount: number }[];
}

export function applyAdjustments(
  basePrice: number | null,
  adjusters: AdjusterRow[],
  scenario: PricingScenario,
  amortizationType: string,
): AdjustedPrice {
  const base = basePrice ?? 100;
  const applied = adjusters
    .filter((a) => adjusterApplies(a, scenario, amortizationType))
    .map((a) => ({ name: a.adjuster_name, amount: Number(a.adjustment) }));
  const total = round3(applied.reduce((sum, a) => sum + a.amount, 0));
  return { basePrice: base, totalAdjustment: total, adjustedPrice: round3(base + total), applied };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
