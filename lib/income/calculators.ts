/**
 * Phase 53 — residential income calculators (Fannie 1084 / Freddie 91, etc.).
 * PURE deterministic functions. No DB, no PII. Each returns monthly qualifying
 * income + Fannie/Freddie figures + human-readable notes.
 */

export interface IncomeCalcResult {
  calculated_income: number;   // monthly qualifying
  fannie_income: number;       // monthly
  freddie_income: number;      // monthly
  calculation_notes: string;
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const usd = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function monthsYtd(asOf: string): number {
  const d = new Date(asOf);
  if (isNaN(d.getTime())) return 12;
  return Math.max(1, d.getMonth() + 1); // Jan=1 … Dec=12
}

// ── 53.2 W-2 salary (B3-3.1-01) ─────────────────────────────────────────────
export function calculateW2Salary(i: Record<string, unknown>): IncomeCalcResult {
  const notes: string[] = [];
  const annualizedYTD = (n(i.ytd_earnings) / monthsYtd(String(i.ytd_as_of_date))) * 12;
  const priorW2 = n(i.prior_year_w2);

  let annual: number;
  if (i.is_new_job) { annual = annualizedYTD; notes.push('New job: annualized YTD per Fannie B3-3.1-01.'); }
  else if (annualizedYTD < priorW2) { annual = Math.min(annualizedYTD, priorW2); notes.push('Declining income: used the lower of annualized YTD vs prior-year W-2.'); }
  else { annual = annualizedYTD; notes.push('Stable/increasing income: used annualized YTD.'); }

  if (n(i.employment_gap_months) > 0) notes.push(`⚠️ Employment gap (${n(i.employment_gap_months)} mo) — underwriter review required.`);
  const monthly = annual / 12;
  return { calculated_income: monthly, fannie_income: monthly, freddie_income: monthly, calculation_notes: notes.join('\n') };
}

// ── 53.3 Self-employed sole proprietor (Schedule C / Fannie 1084) ───────────
function soleYear(i: Record<string, unknown>, p: 'y1' | 'y2'): number {
  return n(i[`${p}_net_profit_loss`]) + n(i[`${p}_depletion`]) + n(i[`${p}_depreciation`]) + n(i[`${p}_business_use_of_home`]) + n(i[`${p}_meals_50pct_not_deductible`]) + n(i[`${p}_non_recurring_expense`]) - n(i[`${p}_non_recurring_income`]);
}
export function calculateSoleProprietor(i: Record<string, unknown>): IncomeCalcResult {
  const notes: string[] = [];
  const y1 = soleYear(i, 'y1');
  notes.push(`Year ${n(i.year1)} qualifying income: ${usd(y1)}.`);
  if (y1 < 0) { notes.push(`⚠️ Business loss in ${n(i.year1)} — $0 qualifying income.`); return { calculated_income: 0, fannie_income: 0, freddie_income: 0, calculation_notes: notes.join('\n') }; }

  let annual: number;
  if (!i.has_year2 || n(i.years_self_employed) < 2) { annual = y1; notes.push('1-year analysis (<2 years self-employed).'); }
  else {
    const y2 = soleYear(i, 'y2');
    notes.push(`Year ${n(i.year2)} qualifying income: ${usd(y2)}.`);
    if (y2 < 0) { annual = 0; notes.push('⚠️ Prior-year loss — qualifying income reduced to $0 per Fannie guidelines.'); }
    else { annual = (y1 + y2) / 2; notes.push(y1 < y2 ? 'Declining income: 2-year average used.' : '2-year average used.'); }
  }
  const ownership = n(i.business_ownership_pct) || 100;
  const monthly = (annual / 12) * (ownership / 100);
  if (i.is_business_still_operating === false) notes.push('⚠️ Business no longer operating — income may not be eligible.');
  return { calculated_income: monthly, fannie_income: monthly, freddie_income: monthly, calculation_notes: notes.join('\n') };
}

// ── 53.4 S-Corp (1120S + W-2) ───────────────────────────────────────────────
function scorpYear(i: Record<string, unknown>, p: 'y1' | 'y2'): number {
  const corp = n(i[`${p}_ordinary_income`]) + n(i[`${p}_depletion`]) + n(i[`${p}_depreciation`]) + n(i[`${p}_amortization`]) + n(i[`${p}_travel_meals`]) + n(i[`${p}_non_recurring_loss`]) - n(i[`${p}_non_recurring_income`]);
  return n(i[`${p}_w2_wages`]) + corp * (n(i.ownership_pct) / 100);
}
export function calculateSCorp(i: Record<string, unknown>): IncomeCalcResult {
  const notes: string[] = ['S-Corp: W-2 wages + (ownership% × 1120S net income after add-backs).'];
  const y1 = scorpYear(i, 'y1');
  let annual = y1;
  if (i.has_year2 && n(i.years_self_employed) >= 2) {
    const y2 = scorpYear(i, 'y2');
    annual = (y1 + y2) / 2;
    notes.push(`2-year average: ${usd(y1)} / ${usd(y2)}.`);
  } else notes.push('1-year analysis.');
  const monthly = Math.max(0, annual / 12);
  return { calculated_income: monthly, fannie_income: monthly, freddie_income: monthly, calculation_notes: notes.join('\n') };
}

// ── 53.5 Schedule E rental (B3-3.1-08) ──────────────────────────────────────
export function calculateScheduleE(i: Record<string, unknown>): IncomeCalcResult {
  const notes: string[] = [];
  const props = Array.isArray(i.properties) ? (i.properties as Record<string, unknown>[]) : [];
  let annual = 0;
  for (const p of props) {
    const addr = String(p.property_address ?? 'Property');
    let inc: number;
    if (p.is_subject_property) {
      const rent = n(p.monthly_market_rent) * 12 || n(p.gross_rents_received);
      inc = rent * 0.75;
      notes.push(`${addr}: subject property — 75% rule applied.`);
    } else {
      inc = n(p.net_income_loss) + n(p.depreciation) + n(p.mortgage_interest) + n(p.other_interest);
      notes.push(inc < 0 ? `⚠️ ${addr}: rental loss ${usd(Math.abs(inc))}/yr — counts in DTI as debt.` : `${addr}: net rental income ${usd(inc)}/yr.`);
    }
    annual += inc;
  }
  const monthly = Math.max(0, annual / 12);
  return { calculated_income: monthly, fannie_income: monthly, freddie_income: monthly, calculation_notes: notes.join('\n') };
}

// ── 53.6 Social Security / pension gross-up (B3-3.1-09) ──────────────────────
export function calculateSSIncome(i: Record<string, unknown>): IncomeCalcResult {
  const notes: string[] = [];
  let monthly = n(i.monthly_gross_amount);
  if (i.is_taxable === false) { monthly *= 1.25; notes.push('Non-taxable income grossed up 25% per agency guidelines.'); }
  if (i.years_remaining !== undefined && n(i.years_remaining) < 3) notes.push(`⚠️ Only ${n(i.years_remaining)} years remaining — may not meet 3-year continuance.`);
  if (i.has_award_letter === false) notes.push('⚠️ Award letter not yet verified — required for qualification.');
  return { calculated_income: monthly, fannie_income: monthly, freddie_income: monthly, calculation_notes: notes.join('\n') };
}

// ── 53.7 Variable income: bonus/commission/overtime (24-mo avg) ──────────────
export function calculateVariableIncome(i: Record<string, unknown>): IncomeCalcResult {
  const notes: string[] = [];
  const annualizedYTD = (n(i.current_ytd) / monthsYtd(String(i.ytd_as_of_date))) * 12;
  const prior = n(i.prior_year_amount);
  const subtype = String(i.income_subtype ?? 'variable');

  let annual: number;
  if (i.trend === 'declining') { annual = Math.min(annualizedYTD, prior); notes.push(`Declining ${subtype}: used the lower of YTD-annualized vs prior year. ⚠️ underwriter may reduce/exclude.`); }
  else { annual = (annualizedYTD + prior) / 2; notes.push(`${subtype} (${String(i.trend ?? 'stable')}): 2-year average used.`); }

  if (i.employer_states_likely_to_continue === false) { annual = 0; notes.push('⚠️ Employer has not confirmed continuance — excluded (conservative).'); }
  const monthly = annual / 12;
  return { calculated_income: monthly, fannie_income: monthly, freddie_income: monthly, calculation_notes: notes.join('\n') };
}

// ── Dispatcher ──────────────────────────────────────────────────────────────
export const INCOME_TYPE_LABELS: Record<string, string> = {
  w2_salary: 'W-2 Salary', w2_hourly: 'W-2 Hourly', self_employed_sole_prop: 'Self-Employed (Sole Prop)',
  self_employed_scorp: 'Self-Employed (S-Corp)', self_employed_partnership: 'Self-Employed (Partnership)',
  rental_schedule_e: 'Rental (Schedule E)', social_security: 'Social Security', pension: 'Pension',
  bonus_commission: 'Bonus / Commission', other_employment: 'Other Employment',
};

export function calculateIncome(incomeType: string, inputs: Record<string, unknown>): IncomeCalcResult | null {
  switch (incomeType) {
    case 'w2_salary':
    case 'w2_hourly': return calculateW2Salary(inputs);
    case 'self_employed_sole_prop': return calculateSoleProprietor(inputs);
    case 'self_employed_scorp':
    case 'self_employed_partnership': return calculateSCorp(inputs);
    case 'rental_schedule_e': return calculateScheduleE(inputs);
    case 'social_security':
    case 'pension': return calculateSSIncome(inputs);
    case 'bonus_commission':
    case 'other_employment': return calculateVariableIncome(inputs);
    default: return null;
  }
}
