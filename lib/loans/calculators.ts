/**
 * Phase 43 — non-agency loan calculators. Pure functions (no DB, client+server).
 */

// ── 43.3 DSCR ──────────────────────────────────────────────────────────────
export interface DscrInputs {
  gross_monthly_rent: number;
  vacancy_rate: number;        // %
  insurance_monthly: number;
  taxes_monthly: number;
  hoa_monthly: number;
  management_fee_pct: number;  // % of effective gross income
  maintenance_monthly: number;
  proposed_loan_amount: number;
  proposed_rate: number;       // annual %
  amortization_years: number;
  is_interest_only: boolean;
}
export interface DscrResult {
  noi: number; annual_debt_service: number; dscr: number;
  dscr_status: 'strong' | 'qualifying' | 'below';
  monthly_cashflow: number; effective_gross_income: number; total_annual_expenses: number;
}

export function calculateDscr(i: DscrInputs): DscrResult {
  const egi = i.gross_monthly_rent * (1 - (i.vacancy_rate || 0) / 100) * 12;
  const mgmt = egi * ((i.management_fee_pct || 0) / 100);
  const annualExpenses = (i.insurance_monthly + i.taxes_monthly + i.hoa_monthly + i.maintenance_monthly) * 12 + mgmt;
  const noi = egi - annualExpenses;

  let ads: number;
  if (i.is_interest_only) {
    ads = i.proposed_loan_amount * (i.proposed_rate / 100);
  } else {
    const r = i.proposed_rate / 100 / 12;
    const n = i.amortization_years * 12;
    const pi = r === 0 ? i.proposed_loan_amount / n : i.proposed_loan_amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    ads = pi * 12;
  }
  const dscr = ads > 0 ? noi / ads : 0;
  return {
    noi, annual_debt_service: ads, dscr,
    dscr_status: dscr >= 1.25 ? 'strong' : dscr >= 1.0 ? 'qualifying' : 'below',
    monthly_cashflow: (noi - ads) / 12, effective_gross_income: egi, total_annual_expenses: annualExpenses,
  };
}

// ── 43.4 Bank statement income ─────────────────────────────────────────────
export interface BankStmtInputs { total_qualifying_deposits: number; period_months: 12 | 24; expense_factor: number; }
export function calculateBankStatementIncome(i: BankStmtInputs) {
  const avg = i.total_qualifying_deposits / i.period_months;
  const monthly = avg * (1 - i.expense_factor);
  return { avg_monthly_deposits: avg, qualifying_monthly_income: monthly, qualifying_annual_income: monthly * 12, expense_factor_used: i.expense_factor, period_months: i.period_months };
}

// ── 43.5 1099 income ───────────────────────────────────────────────────────
export interface Income1099Inputs { year1_total: number; year2_total?: number; expense_factor: number; use_2_year_avg: boolean; }
export function calculate1099Income(i: Income1099Inputs) {
  const base = i.use_2_year_avg && i.year2_total ? (i.year1_total + i.year2_total) / 2 : i.year1_total;
  return { gross_annual: base, qualifying_annual: base * (1 - i.expense_factor), qualifying_monthly: (base * (1 - i.expense_factor)) / 12, expense_factor_used: i.expense_factor };
}

// ── 43.6 Condo warrantability ──────────────────────────────────────────────
export interface CondoCheck {
  investor_concentration: number; delinquency_rate: number; commercial_space_pct: number;
  is_litigation: boolean; is_hotel_condo: boolean; fha_approved: boolean; completion_pct: number;
}
export function checkCondoWarrantability(c: CondoCheck) {
  const flags: string[] = [];
  if (c.investor_concentration > 10) flags.push(`Investor concentration ${c.investor_concentration}% (limit 10%)`);
  if (c.delinquency_rate > 15) flags.push(`HOA delinquency ${c.delinquency_rate}% (limit 15%)`);
  if (c.commercial_space_pct > 35) flags.push(`Commercial space ${c.commercial_space_pct}% (limit 35%)`);
  if (c.is_litigation) flags.push('Active HOA litigation');
  if (c.is_hotel_condo) flags.push('Condotel — hotel-style rental');
  if (c.completion_pct < 70) flags.push(`Project ${c.completion_pct}% sold (minimum 70%)`);
  const is_warrantable = flags.length === 0;
  return {
    is_warrantable, is_fha_eligible: is_warrantable && c.fha_approved, flags,
    recommendation: is_warrantable ? 'Eligible for conventional / FHA financing' : 'Non-warrantable — routes to Non-QM portfolio lenders. Open Scenario AI for lender match.',
  };
}
