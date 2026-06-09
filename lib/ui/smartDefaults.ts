/**
 * Phase 28.3 — Smart default values keyed off LoanContext.
 */
import type { LoanContext } from './fieldAdapter';

export interface LoanFormDefaults {
  max_ltv?: number;
  min_down_pct?: number;
  mip_upfront_pct?: number;
  mip_monthly_pct?: number;
  pmi_monthly?: number;
  usda_guarantee_pct?: number;
}

export function getSmartDefaults(ctx: LoanContext): LoanFormDefaults {
  const defaults: LoanFormDefaults = {};

  if (ctx.loan_program === 'FHA') {
    defaults.max_ltv = 96.5;
    defaults.min_down_pct = 3.5;
    defaults.mip_upfront_pct = 1.75;
    defaults.mip_monthly_pct = ctx.loan_amount > 150000 ? 0.55 : 0.5;
  }
  if (ctx.loan_program === 'VA') {
    defaults.max_ltv = 100;
    defaults.min_down_pct = 0;
    // Funding fee determined by usage + down payment, applied on save.
  }
  if (ctx.loan_program === 'USDA') {
    defaults.max_ltv = 100;
    defaults.min_down_pct = 0;
    defaults.usda_guarantee_pct = 1.0;
  }
  if (ctx.loan_program === 'Conventional' && ctx.down_payment_pct >= 20) {
    defaults.pmi_monthly = 0;
  }

  return defaults;
}
