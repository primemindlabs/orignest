/**
 * Phase 28.3 — Field visibility rules. A field shows only when its predicate
 * passes for the current LoanContext. Fields not listed here are always visible.
 */
import type { LoanContext } from './fieldAdapter';

export interface FieldRule {
  show: (ctx: LoanContext) => boolean;
}

export const FIELD_RULES: Record<string, FieldRule> = {
  // FHA-specific
  mip_upfront: { show: (ctx) => ctx.loan_program === 'FHA' },
  mip_monthly: { show: (ctx) => ctx.loan_program === 'FHA' },
  // VA-specific
  va_funding_fee: { show: (ctx) => ctx.loan_program === 'VA' },
  certificate_of_elig: { show: (ctx) => ctx.loan_program === 'VA' },
  va_disability_exempt: { show: (ctx) => ctx.loan_program === 'VA' },
  // Conventional PMI
  pmi_section: { show: (ctx) => ctx.loan_program === 'Conventional' && ctx.down_payment_pct < 20 },
  // USDA
  usda_guarantee_fee: { show: (ctx) => ctx.loan_program === 'USDA' },
  usda_income_limit: { show: (ctx) => ctx.loan_program === 'USDA' },
  // Condo/PUD
  hoa_cert_required: { show: (ctx) => ['Condo', 'PUD'].includes(ctx.property_type) },
  hoa_monthly_dues: { show: (ctx) => ['Condo', 'PUD'].includes(ctx.property_type) },
  // Self-employed income
  se_income_worksheet: { show: (ctx) => ctx.is_self_employed },
  ytd_pl_statement: { show: (ctx) => ctx.is_self_employed },
  cpa_letter_required: { show: (ctx) => ctx.is_self_employed },
  // Co-borrower
  co_borrower_section: { show: (ctx) => ctx.has_co_borrower },
  // Purchase vs refi
  purchase_price: { show: (ctx) => ctx.transaction_type === 'Purchase' },
  seller_concessions: { show: (ctx) => ctx.transaction_type === 'Purchase' },
  listing_agent_name: { show: (ctx) => ctx.transaction_type === 'Purchase' },
  payoff_amount: { show: (ctx) => ctx.transaction_type !== 'Purchase' },
  cash_out_purpose: { show: (ctx) => ctx.transaction_type === 'Cash-Out-Refi' },
  // Investment / second home
  rental_income_section: { show: (ctx) => ctx.occupancy === 'Investment' },
  rental_history: { show: (ctx) => ctx.occupancy !== 'Primary' },
  // REO
  reo_section: { show: (ctx) => ctx.has_reo },
  // Military
  military_service_dates: { show: (ctx) => ctx.is_military },
  dd214_required: { show: (ctx) => ctx.is_military },
};

/** Field is visible when it has no rule, or its rule passes. */
export function isFieldVisible(fieldKey: string, ctx: LoanContext): boolean {
  const rule = FIELD_RULES[fieldKey];
  return !rule || rule.show(ctx);
}
