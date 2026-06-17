// Phase 142 — PPE eligibility (PURE). A PPE's accuracy edge over a raw rate sheet
// is that it never quotes a product the borrower can't actually get. This returns
// a verdict + human-readable reasons so ineligible products are shown greyed with
// the "why", not silently dropped.

import type { PricingScenario } from './types';

export interface ProductConstraints {
  loan_type: string;
  term_years: number;
  min_fico: number | null;
  max_fico: number | null;
  min_ltv: number | null;
  max_ltv: number | null;
  min_loan_amount: number | null;
  max_loan_amount: number | null;
}

export interface EligibilityVerdict {
  eligible: boolean;
  reasons: string[];
}

export function evaluateEligibility(p: ProductConstraints, s: PricingScenario): EligibilityVerdict {
  const reasons: string[] = [];

  if (p.loan_type.toLowerCase() !== s.loanType.toLowerCase()) {
    reasons.push(`Loan type ${p.loan_type} ≠ ${s.loanType}`);
  }
  if (p.term_years !== s.termYears) {
    reasons.push(`${p.term_years}yr term ≠ requested ${s.termYears}yr`);
  }
  if (p.min_fico != null && s.fico < Number(p.min_fico)) {
    reasons.push(`FICO ${s.fico} below min ${p.min_fico}`);
  }
  if (p.max_fico != null && s.fico > Number(p.max_fico)) {
    reasons.push(`FICO ${s.fico} above max ${p.max_fico}`);
  }
  if (p.max_ltv != null && s.ltv > Number(p.max_ltv)) {
    reasons.push(`LTV ${s.ltv.toFixed(1)}% over max ${Number(p.max_ltv).toFixed(1)}%`);
  }
  if (p.min_ltv != null && s.ltv < Number(p.min_ltv)) {
    reasons.push(`LTV ${s.ltv.toFixed(1)}% under min ${Number(p.min_ltv).toFixed(1)}%`);
  }
  if (s.loanAmount > 0 && p.max_loan_amount != null && s.loanAmount > Number(p.max_loan_amount)) {
    reasons.push(`Loan amount over max ${Number(p.max_loan_amount).toLocaleString()}`);
  }
  if (s.loanAmount > 0 && p.min_loan_amount != null && s.loanAmount < Number(p.min_loan_amount)) {
    reasons.push(`Loan amount under min ${Number(p.min_loan_amount).toLocaleString()}`);
  }

  return { eligible: reasons.length === 0, reasons };
}
