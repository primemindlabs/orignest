/**
 * Phase 51.12 — Non-QM qualifying-income calculators. Pure (client+server).
 * Complements the Phase 43 DSCR/bank-statement/1099 calculators.
 */

export interface QualifyingIncomeResult {
  qualifying_monthly: number;
  qualifying_annual: number;
  income_basis: string;
}

/** Bank-statement income: average monthly deposits × deposit %. */
export function bankStatementIncome(opts: { monthly_deposit_totals: number[]; account_type: 'business' | 'personal'; deposit_pct: number; months: 12 | 24 }): QualifyingIncomeResult & { gross_monthly_deposits: number; months_analyzed: number } {
  const rel = opts.monthly_deposit_totals.slice(-opts.months);
  const avg = rel.length ? rel.reduce((a, b) => a + b, 0) / rel.length : 0;
  const monthly = avg * (Math.min(100, Math.max(0, opts.deposit_pct)) / 100);
  return {
    gross_monthly_deposits: avg, months_analyzed: rel.length,
    qualifying_monthly: monthly, qualifying_annual: monthly * 12,
    income_basis: `${opts.months}-month ${opts.account_type} bank statement · ${opts.deposit_pct}% of deposits`,
  };
}

/** Asset depletion: (assets − down − closing) / depletion months. */
export function assetDepletionIncome(assets: number, downPayment: number, closingCosts: number, months = 360): QualifyingIncomeResult {
  const eligible = Math.max(0, assets - downPayment - closingCosts);
  const monthly = months > 0 ? eligible / months : 0;
  return { qualifying_monthly: monthly, qualifying_annual: monthly * 12, income_basis: `Asset depletion · $${eligible.toLocaleString()} over ${months} months` };
}

/** 1099 income: 2-year average gross × (1 − expense factor). */
export function income1099(year1Gross: number, year2Gross: number, expenseFactor: number): QualifyingIncomeResult {
  const avg = year2Gross ? (year1Gross + year2Gross) / 2 : year1Gross;
  const net = avg * (1 - Math.min(1, Math.max(0, expenseFactor)));
  return { qualifying_monthly: net / 12, qualifying_annual: net, income_basis: `2-year 1099 avg · ${Math.round(expenseFactor * 100)}% expense factor` };
}
