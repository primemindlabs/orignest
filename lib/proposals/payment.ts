// Phase 122 — proposal payment breakdown. PURE. Estimates are clearly labeled as
// estimates downstream; only P&I is exact (carried from the scenario). Taxes,
// insurance and PMI are industry-standard ESTIMATES so the borrower sees a realistic
// total — never represented as exact or guaranteed.

export interface ScenarioLike {
  purchase_price: number | null;
  down_payment_pct: number | null;
  loan_amount: number | null;
  interest_rate: number | null;
  loan_term_months: number | null;
  monthly_payment: number | null;
  total_interest_paid: number | null;
}

export interface PaymentBreakdown {
  principal_interest: number;
  est_property_tax: number;
  est_homeowners_insurance: number;
  est_pmi: number;
  est_total_monthly: number;
  has_pmi: boolean;
}

// Conservative annual estimate rates (national ballpark; labeled "estimated" in the UI).
const PROPERTY_TAX_ANNUAL_PCT = 0.011; // 1.1% of purchase price / yr
const INSURANCE_ANNUAL_PCT = 0.0035; // 0.35% of purchase price / yr
const PMI_ANNUAL_PCT = 0.005; // 0.5% of loan amount / yr, only when < 20% down

export function computePaymentBreakdown(s: ScenarioLike): PaymentBreakdown {
  const price = Number(s.purchase_price ?? 0);
  const loan = Number(s.loan_amount ?? 0);
  const pi = Number(s.monthly_payment ?? 0);
  const hasPmi = Number(s.down_payment_pct ?? 0) < 20 && loan > 0;

  const tax = Math.round((price * PROPERTY_TAX_ANNUAL_PCT) / 12);
  const ins = Math.round((price * INSURANCE_ANNUAL_PCT) / 12);
  const pmi = hasPmi ? Math.round((loan * PMI_ANNUAL_PCT) / 12) : 0;

  return {
    principal_interest: Math.round(pi),
    est_property_tax: tax,
    est_homeowners_insurance: ins,
    est_pmi: pmi,
    est_total_monthly: Math.round(pi) + tax + ins + pmi,
    has_pmi: hasPmi,
  };
}

export const termYears = (months: number | null | undefined) => Math.round((Number(months ?? 360)) / 12);
