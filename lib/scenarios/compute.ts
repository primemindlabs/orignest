// Phase 115 — loan scenario math. PURE.

export interface ScenarioInputs {
  purchase_price: number;
  down_payment_pct: number;
  interest_rate: number; // annual %
  loan_term_months: number;
}

export interface ScenarioMetrics {
  loan_amount: number;
  monthly_payment: number;
  total_interest_paid: number;
  total_cost_of_loan: number;
}

export function computeMonthlyPayment(principal: number, annualRatePct: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * (r * Math.pow(1 + r, termMonths))) / (Math.pow(1 + r, termMonths) - 1);
}

export function computeScenarioMetrics(s: ScenarioInputs): ScenarioMetrics {
  const loanAmount = s.purchase_price * (1 - (s.down_payment_pct || 0) / 100);
  const monthly = computeMonthlyPayment(loanAmount, s.interest_rate, s.loan_term_months || 360);
  const totalPaid = monthly * (s.loan_term_months || 360);
  return {
    loan_amount: Math.round(loanAmount),
    monthly_payment: Math.round(monthly * 100) / 100,
    total_interest_paid: Math.round(totalPaid - loanAmount),
    total_cost_of_loan: Math.round(totalPaid),
  };
}

/** Months until the upfront cost difference is recovered by the monthly-payment savings. */
export function computeBreakEven(
  a: { monthly_payment: number; loan_amount: number },
  b: { monthly_payment: number; loan_amount: number }
): number | null {
  const monthlySavings = Math.abs(a.monthly_payment - b.monthly_payment);
  if (monthlySavings === 0) return null;
  const upfrontDiff = Math.abs(a.loan_amount - b.loan_amount);
  if (upfrontDiff === 0) return null;
  return Math.ceil(upfrontDiff / monthlySavings);
}

export const isArm = (loanType: string) => loanType.startsWith('arm_');
