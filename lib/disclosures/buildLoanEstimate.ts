/**
 * Phase 148 — preliminary Loan Estimate builder. PURE / testable.
 *
 * Computes the borrower-facing figures for a Loan Estimate worksheet from the loan
 * terms + a fee worksheet: loan terms, monthly principal & interest, itemized closing
 * costs (the five TRID buckets), and estimated cash to close. This is a PRELIMINARY
 * estimate, not the APR-bearing Loan Estimate disclosure of record — labeled as such,
 * and never quotes an APR it can't legally compute.
 */

export interface FeeWorksheet {
  origination_charges?: number;            // A
  services_cannot_shop?: number;           // B
  services_can_shop?: number;              // C
  taxes_government_fees?: number;          // E
  prepaids?: number;                       // F
  initial_escrow?: number;                 // G
  other?: number;                          // H
  lender_credits?: number;                 // negative adjustment
}

export interface LoanEstimateInput {
  loanAmount: number;
  interestRate: number;       // annual %, e.g. 6.875
  termMonths: number;
  loanType?: string | null;
  loanPurpose?: string | null;
  amortizationType?: string | null;
  purchasePrice?: number | null;
  propertyAddress?: string | null;
  fees: FeeWorksheet;
}

export interface LoanEstimate {
  loan: { amount: number; rate: number; termMonths: number; product: string; purpose: string; monthlyPI: number };
  property: { address: string | null; purchasePrice: number | null };
  closingCosts: {
    origination_charges: number; services_cannot_shop: number; services_can_shop: number;
    taxes_government_fees: number; prepaids: number; initial_escrow: number; other: number;
    total_loan_costs: number; total_other_costs: number; lender_credits: number; total_closing_costs: number;
  };
  cashToClose: number;
  estimatedDownPayment: number;
  disclaimer: string;
}

const n = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const round2 = (x: number): number => Math.round(x * 100) / 100;

/** Standard fully-amortizing monthly principal & interest. */
export function monthlyPI(amount: number, annualRatePct: number, termMonths: number): number {
  const p = n(amount); const months = n(termMonths);
  if (p <= 0 || months <= 0) return 0;
  const r = n(annualRatePct) / 100 / 12;
  if (r === 0) return round2(p / months);
  return round2((p * r) / (1 - Math.pow(1 + r, -months)));
}

export function buildLoanEstimate(input: LoanEstimateInput): LoanEstimate {
  const f = input.fees ?? {};
  const origination = n(f.origination_charges);
  const cannotShop = n(f.services_cannot_shop);
  const canShop = n(f.services_can_shop);
  const taxes = n(f.taxes_government_fees);
  const prepaids = n(f.prepaids);
  const escrow = n(f.initial_escrow);
  const other = n(f.other);
  const credits = n(f.lender_credits);

  const totalLoanCosts = round2(origination + cannotShop + canShop);
  const totalOtherCosts = round2(taxes + prepaids + escrow + other);
  const totalClosing = round2(totalLoanCosts + totalOtherCosts - credits);

  const purchasePrice = input.purchasePrice != null ? n(input.purchasePrice) : null;
  const downPayment = purchasePrice != null ? round2(Math.max(0, purchasePrice - n(input.loanAmount))) : 0;
  const isPurchase = (input.loanPurpose ?? '').toLowerCase().includes('purchase');
  const cashToClose = round2((isPurchase ? downPayment : 0) + totalClosing);

  return {
    loan: {
      amount: round2(n(input.loanAmount)),
      rate: n(input.interestRate),
      termMonths: n(input.termMonths),
      product: prettyProduct(input.loanType, input.amortizationType, input.termMonths),
      purpose: input.loanPurpose ?? 'Purchase',
      monthlyPI: monthlyPI(input.loanAmount, input.interestRate, input.termMonths),
    },
    property: { address: input.propertyAddress ?? null, purchasePrice },
    closingCosts: {
      origination_charges: round2(origination), services_cannot_shop: round2(cannotShop), services_can_shop: round2(canShop),
      taxes_government_fees: round2(taxes), prepaids: round2(prepaids), initial_escrow: round2(escrow), other: round2(other),
      total_loan_costs: totalLoanCosts, total_other_costs: totalOtherCosts, lender_credits: round2(credits), total_closing_costs: totalClosing,
    },
    cashToClose,
    estimatedDownPayment: downPayment,
    disclaimer: 'This is a preliminary estimate for planning only — not the official Loan Estimate, not an APR disclosure, and not a commitment to lend. Figures are estimates and may change. Your official Loan Estimate will be provided within 3 business days of a completed application.',
  };
}

function prettyProduct(loanType?: string | null, amort?: string | null, termMonths?: number): string {
  const years = termMonths ? Math.round(termMonths / 12) : null;
  const a = (amort ?? '').toLowerCase().includes('arm') || (amort ?? '').toLowerCase().includes('adjust') ? 'ARM' : 'Fixed';
  const t = (loanType ?? 'Conventional').toUpperCase();
  return [years ? `${years}-Year` : null, a, t].filter(Boolean).join(' ');
}
