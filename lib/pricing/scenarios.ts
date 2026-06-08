// Shared scenario-comparison math used by the Scenarios page and its PDF route.
// Uses standard mortgage math inline (per Sprint 2 spec) rather than the
// full eligibility engine in calculator.ts.

export const CONFORMING_LIMIT = 766_550;

export interface BorrowerProfile {
  creditScore: number;
  annualIncome: number;
  monthlyDebt: number;
  purchasePrice: number;
  downPayment: number;
  propertyType: string;
  occupancy: string; // 'Primary' | 'Second Home' | 'Investment'
}

export interface ProgramDef {
  key: string;
  name: string;
  rate: number;       // annual % rate
  termYears: number;
  minCredit: number;
  pmi: boolean;       // true if this program inherently has MI (FHA) — refined per-LTV below
  defaultOn: boolean;
}

export interface ProgramResult {
  key: string;
  name: string;
  rate: number;
  termYears: number;
  monthlyPI: number;
  monthlyPayment: number; // PITI
  cashToClose: number;
  minCredit: number;
  pmi: boolean;
  tags: string[];
}

// Representative rates. Base conforming 30yr aligns with CURRENT_MARKET_RATE default.
export const PROGRAMS: ProgramDef[] = [
  { key: 'conv30', name: 'Conventional 30yr', rate: 6.875, termYears: 30, minCredit: 620, pmi: false, defaultOn: true },
  { key: 'conv15', name: 'Conventional 15yr', rate: 6.25, termYears: 15, minCredit: 620, pmi: false, defaultOn: true },
  { key: 'fha30', name: 'FHA 30yr', rate: 6.625, termYears: 30, minCredit: 580, pmi: true, defaultOn: true },
  { key: 'va30', name: 'VA 30yr', rate: 6.5, termYears: 30, minCredit: 620, pmi: false, defaultOn: false },
  { key: 'dscr', name: 'DSCR', rate: 7.75, termYears: 30, minCredit: 660, pmi: false, defaultOn: false },
  { key: 'jumbo30', name: 'Jumbo 30yr', rate: 7.0, termYears: 30, minCredit: 700, pmi: false, defaultOn: false },
];

const EST_TAXES = 250;
const EST_INSURANCE = 100;
const CLOSING_COST_PCT = 0.025;

export function monthlyPayment(principal: number, annualRate: number, termYears = 30): number {
  if (principal <= 0) return 0;
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// Which optional programs are available for a given profile.
export function availablePrograms(profile: BorrowerProfile): ProgramDef[] {
  const loanAmount = Math.max(profile.purchasePrice - profile.downPayment, 0);
  return PROGRAMS.filter((p) => {
    if (p.key === 'va30') return profile.creditScore >= 620;
    if (p.key === 'dscr') return profile.occupancy === 'Investment';
    if (p.key === 'jumbo30') return loanAmount > CONFORMING_LIMIT;
    return true;
  });
}

export function computeProgram(profile: BorrowerProfile, def: ProgramDef): ProgramResult {
  const loanAmount = Math.max(profile.purchasePrice - profile.downPayment, 0);
  const ltv = profile.purchasePrice > 0 ? loanAmount / profile.purchasePrice : 0;

  // PMI/MIP rules
  let hasPmi = false;
  let pmiMonthly = 0;
  if (def.key === 'fha30') {
    hasPmi = true;
    pmiMonthly = (loanAmount * 0.0055) / 12; // FHA MIP ~0.55%/yr
  } else if (def.key === 'va30' || def.key === 'jumbo30' || def.key === 'dscr') {
    hasPmi = false;
  } else if (def.key === 'conv30' || def.key === 'conv15') {
    hasPmi = ltv > 0.8; // conventional < 20% down
    if (hasPmi) pmiMonthly = (loanAmount * 0.005) / 12; // ~0.5%/yr
  }

  const pi = monthlyPayment(loanAmount, def.rate, def.termYears);
  const piti = pi + EST_TAXES + EST_INSURANCE + pmiMonthly;
  const cashToClose = profile.downPayment + profile.purchasePrice * CLOSING_COST_PCT;

  return {
    key: def.key,
    name: def.name,
    rate: def.rate,
    termYears: def.termYears,
    monthlyPI: Math.round(pi),
    monthlyPayment: Math.round(piti),
    cashToClose: Math.round(cashToClose),
    minCredit: def.minCredit,
    pmi: hasPmi,
    tags: [],
  };
}

// Compute results for the selected program keys and assign "Best For" tags.
export function computeResults(profile: BorrowerProfile, selectedKeys: string[]): ProgramResult[] {
  const defs = PROGRAMS.filter((p) => selectedKeys.includes(p.key));
  const results = defs.map((d) => computeProgram(profile, d));
  if (results.length === 0) return results;

  const lowestPayment = Math.min(...results.map((r) => r.monthlyPayment));
  const lowestRate = Math.min(...results.map((r) => r.rate));
  const lowestCash = Math.min(...results.map((r) => r.cashToClose));

  for (const r of results) {
    if (r.monthlyPayment === lowestPayment) r.tags.push('Lowest Payment');
    if (r.rate === lowestRate) r.tags.push('Lowest Rate');
    if (!r.pmi) r.tags.push('No PMI');
    if (r.cashToClose === lowestCash) r.tags.push('Lowest Cash to Close');
  }
  return results;
}
