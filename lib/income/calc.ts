/**
 * Qualifying-income calculators — pure, framework-agnostic.
 *
 * Mirrors the standard agency worksheets:
 *  - Self-employed: Fannie Mae Form 1084 / Freddie Mac Form 91 (Schedule C add-backs, 24-mo avg)
 *  - Rental: Schedule E 75% gross-rent method
 *  - Non-taxable gross-up (Social Security, child support, etc.)
 *  - DSCR ratio for investor loans
 *  - DTI rollup
 *
 * These are computational aids, not underwriting decisions.
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round0 = (n: number) => Math.round(n);

/** One tax year of Schedule C / 1084 inputs. */
export interface SelfEmployedYear {
  netProfit: number;          // Schedule C line 31 (or K-1/1120S ordinary income)
  depreciation: number;       // add back
  depletion: number;          // add back
  amortizationCasualty: number; // add back
  businessUseOfHome: number;  // add back
  mealsExclusion: number;     // subtract (nondeductible meals already excluded → 0 typical)
  nonrecurringIncome: number; // subtract one-time/nonrecurring income
}

function adjustedYear(y: SelfEmployedYear): number {
  return (
    y.netProfit +
    y.depreciation +
    y.depletion +
    y.amortizationCasualty +
    y.businessUseOfHome -
    y.mealsExclusion -
    y.nonrecurringIncome
  );
}

/**
 * Fannie 1084 / Freddie 91 self-employed monthly income.
 * Averages the adjusted annual figures over the number of months represented
 * (typically 24 for two full years). Trending guard: if the most recent year
 * declined, the average is used (conservative) and a flag is returned.
 */
export function selfEmployedMonthly(years: SelfEmployedYear[]): {
  monthlyIncome: number;
  adjustedByYear: number[];
  declining: boolean;
} {
  const adjusted = years.map(adjustedYear);
  const months = years.length * 12 || 12;
  const total = adjusted.reduce((s, n) => s + n, 0);
  const declining = adjusted.length >= 2 && adjusted[adjusted.length - 1] < adjusted[adjusted.length - 2];
  return {
    monthlyIncome: round2(Math.max(0, total / months)),
    adjustedByYear: adjusted.map(round0),
    declining,
  };
}

/**
 * Schedule E rental income, 75%-of-gross method.
 * netMonthly = grossMonthlyRent * 0.75 − full monthly PITIA.
 * Positive → qualifying income; negative → a monthly liability.
 */
export function rentalMonthly(grossMonthlyRent: number, monthlyPitia: number, vacancyFactor = 0.75): {
  effectiveRent: number;
  netMonthly: number;
  isLiability: boolean;
} {
  const effectiveRent = round2(grossMonthlyRent * vacancyFactor);
  const netMonthly = round2(effectiveRent - monthlyPitia);
  return { effectiveRent, netMonthly, isLiability: netMonthly < 0 };
}

/**
 * Gross up non-taxable income (e.g. Social Security). Fannie permits up to 25%;
 * many lenders use 15%. Caller supplies the percent.
 */
export function grossUp(amount: number, grossUpPct = 25): number {
  return round2(amount * (1 + grossUpPct / 100));
}

/** DSCR = qualifying rent / PITIA. ≥ 1.0 means the property covers its debt. */
export function dscr(grossMonthlyRent: number, monthlyPitia: number): { ratio: number; qualifies: boolean } {
  if (monthlyPitia <= 0) return { ratio: 0, qualifies: false };
  const ratio = round2(grossMonthlyRent / monthlyPitia);
  return { ratio, qualifies: ratio >= 1.0 };
}

/** Front-end (housing) and back-end (total debt) DTI ratios. */
export function dti(params: {
  monthlyIncome: number;
  proposedHousingPayment: number;
  otherMonthlyDebts: number;
}): { frontEnd: number; backEnd: number } {
  const { monthlyIncome, proposedHousingPayment, otherMonthlyDebts } = params;
  if (monthlyIncome <= 0) return { frontEnd: 0, backEnd: 0 };
  return {
    frontEnd: round2((proposedHousingPayment / monthlyIncome) * 100),
    backEnd: round2(((proposedHousingPayment + otherMonthlyDebts) / monthlyIncome) * 100),
  };
}
