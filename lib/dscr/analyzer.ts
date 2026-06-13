// Phase 112 — DSCR Investment Analyzer (1–9 unit). PURE.
//
// Reuses the established NOI/payment model (lib/loans/calculators.calculateDscr) and
// extends it for SMALL MULTIFAMILY (5–9 unit): a distinct capex reserve line and
// unit-count-based qualification thresholds.
//   Residential DSCR (1–4 unit): min 1.0, preferred 1.25
//   Small commercial (5–9 unit): min 1.25, preferred 1.35

export type DscrPropertyType = 'residential_dscr' | 'small_commercial';
export type DscrBand = 'strong' | 'qualifying' | 'failing';

export interface DscrInputs {
  unit_count: number; // 1–9
  gross_monthly_rent: number;
  vacancy_rate_pct: number;
  monthly_taxes: number;
  monthly_insurance: number;
  monthly_hoa: number;
  management_pct: number;
  maintenance_pct: number;
  capex_reserve_pct: number;
  loan_amount: number;
  interest_rate: number; // annual %
  loan_term_months: number;
}

export interface DscrResult {
  property_type: DscrPropertyType;
  is_commercial: boolean;
  effective_gross_income: number; // monthly
  management_expense: number;
  maintenance_expense: number;
  capex_expense: number;
  total_operating_expenses: number; // monthly
  net_operating_income: number; // monthly
  monthly_debt_service: number;
  dscr: number;
  minimum_dscr: number;
  preferred_dscr: number;
  qualifies: boolean;
  band: DscrBand;
  notes: string;
}

export function monthlyPayment(loanAmount: number, annualRatePct: number, termMonths: number): number {
  if (loanAmount <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return loanAmount / termMonths;
  return (loanAmount * (r * Math.pow(1 + r, termMonths))) / (Math.pow(1 + r, termMonths) - 1);
}

export function analyzeDscr(i: DscrInputs): DscrResult {
  const isCommercial = i.unit_count >= 5;
  const propertyType: DscrPropertyType = isCommercial ? 'small_commercial' : 'residential_dscr';

  const egi = i.gross_monthly_rent * (1 - (i.vacancy_rate_pct || 0) / 100);
  const management_expense = egi * ((i.management_pct || 0) / 100);
  const maintenance_expense = egi * ((i.maintenance_pct || 0) / 100);
  const capex_expense = egi * ((i.capex_reserve_pct || 0) / 100);
  const totalOpEx =
    (i.monthly_taxes ?? 0) + (i.monthly_insurance ?? 0) + (i.monthly_hoa ?? 0) +
    management_expense + maintenance_expense + capex_expense;
  const noi = egi - totalOpEx;

  const mds = monthlyPayment(i.loan_amount, i.interest_rate, i.loan_term_months || 360);
  const dscrRaw = mds > 0 ? noi / mds : 0;
  const dscr = Math.round(dscrRaw * 1000) / 1000;

  const minimum = isCommercial ? 1.25 : 1.0;
  const preferred = isCommercial ? 1.35 : 1.25;
  const qualifies = dscr >= minimum;
  const band: DscrBand = dscr >= preferred ? 'strong' : qualifies ? 'qualifying' : 'failing';

  const notes = !qualifies
    ? `DSCR of ${dscr.toFixed(3)} is below the ${minimum.toFixed(2)} ${isCommercial ? 'small-commercial' : 'residential'} minimum. ` +
      `Consider reducing the loan amount by ~${Math.max(1, Math.ceil((1 - dscr / minimum) * 100))}% or increasing rents.`
    : dscr < preferred
      ? `DSCR qualifies but rates will be higher — the preferred (best-tier) threshold is ${preferred.toFixed(2)}.`
      : `Strong DSCR — qualifies for best-tier pricing at most lenders.`;

  return {
    property_type: propertyType,
    is_commercial: isCommercial,
    effective_gross_income: round2(egi),
    management_expense: round2(management_expense),
    maintenance_expense: round2(maintenance_expense),
    capex_expense: round2(capex_expense),
    total_operating_expenses: round2(totalOpEx),
    net_operating_income: round2(noi),
    monthly_debt_service: round2(mds),
    dscr,
    minimum_dscr: minimum,
    preferred_dscr: preferred,
    qualifies,
    band,
    notes,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
