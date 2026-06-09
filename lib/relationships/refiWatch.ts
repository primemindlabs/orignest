/**
 * Phase 29.4a — Refi opportunity math (deterministic).
 */
export const REFI_CLOSING_COST_ESTIMATE = 5000;
export const EQUITY_MILESTONES = [25000, 50000, 75000, 100000, 150000, 200000, 250000, 500000];

export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

function monthsSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return Math.max(0, Math.round((Date.now() - d.getTime()) / (86_400_000 * 30.44)));
}

export interface RefiInput {
  original_loan_amount: number | null;
  original_rate: number | null;
  current_balance: number | null;
  purchase_date: string | null;
}

export interface RefiOpportunity {
  original_rate: number | null;
  current_rate: number;
  rate_delta: number | null;
  monthly_savings: number;
  annual_savings: number;
  five_year_savings: number;
  break_even_months: number | null;
  worth_it: boolean;
}

export function computeRefiOpportunity(p: RefiInput, currentMarketRate: number): RefiOpportunity {
  const origAmt = p.original_loan_amount ?? 0;
  const origRate = p.original_rate;
  const balance = p.current_balance ?? origAmt;
  const elapsed = monthsSince(p.purchase_date);
  const remainingMonths = Math.max(12, 360 - elapsed);

  const originalPayment = origRate != null ? monthlyPayment(origAmt, origRate, 360) : 0;
  const newPayment = monthlyPayment(balance, currentMarketRate, remainingMonths);
  const monthlySavings = Math.max(0, Math.round((originalPayment - newPayment) * 100) / 100);
  const breakEven = monthlySavings > 0 ? Math.ceil(REFI_CLOSING_COST_ESTIMATE / monthlySavings) : null;

  return {
    original_rate: origRate,
    current_rate: currentMarketRate,
    rate_delta: origRate != null ? Math.round((origRate - currentMarketRate) * 1000) / 1000 : null,
    monthly_savings: monthlySavings,
    annual_savings: Math.round(monthlySavings * 12),
    five_year_savings: Math.round(monthlySavings * 60),
    break_even_months: breakEven,
    worth_it: breakEven != null && breakEven <= 36 && monthlySavings >= 100,
  };
}
