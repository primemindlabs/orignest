// ─── AshleyIQ Pricing Calculator ─────────────────────────────────────────────
// Pure functions — no DB, no side effects, safe to run client-side.

export type LoanProgram =
  | 'conventional'
  | 'fha'
  | 'va'
  | 'usda'
  | 'jumbo'
  | 'dscr'
  | 'bank_statement'
  | 'fha_203k';

export type EligibilityStatus = 'eligible' | 'conditional' | 'ineligible';

export interface EligibilityResult {
  program: LoanProgram;
  status: EligibilityStatus;
  reason?: string;
  rateRangeLow: number;
  rateRangeHigh: number;
  apr: number;
  monthlyPI: number;
  monthlyMI: number;
  monthlyTotal: number;
  cashToClose: number;
  totalInterest: number;
  frontDTI: number;
  backDTI: number;
  loanAmount: number;
  ltv: number;
}

export interface EligibilityParams {
  creditScore: number;
  annualIncome: number;
  monthlyDebts: number;
  purchasePrice: number;
  downPaymentAmount: number;
  propertyType: string;
  occupancy: string;
  state: string;
  loanPurpose: string;
  termMonths: number;
  vaEligible: boolean;
  rentalIncome?: number;
}

// ─── Core Math ────────────────────────────────────────────────────────────────

export function calculateLoanAmount(
  purchasePrice: number,
  downPayment: number
): number {
  return Math.max(0, purchasePrice - downPayment);
}

export function calculateLTV(
  loanAmount: number,
  propertyValue: number
): number {
  if (propertyValue <= 0) return 0;
  return (loanAmount / propertyValue) * 100;
}

export interface DTIResult {
  front: number;
  back: number;
}

export function calculateDTI(
  monthlyDebts: number,
  monthlyIncome: number,
  proposedPayment: number
): DTIResult {
  if (monthlyIncome <= 0) return { front: 999, back: 999 };
  const front = (proposedPayment / monthlyIncome) * 100;
  const back = ((proposedPayment + monthlyDebts) / monthlyIncome) * 100;
  return { front, back };
}

/**
 * Monthly MI:
 *  - FHA: annual MIP rate * loanAmount / 12
 *  - Conventional PMI: tiered by LTV and FICO
 */
export function calculateMI(
  loanAmount: number,
  ltv: number,
  loanType: LoanProgram,
  creditScore: number
): number {
  if (loanType === 'fha') {
    // Standard FHA annual MIP: 0.55% for most loans
    return (loanAmount * 0.0055) / 12;
  }
  if (loanType === 'conventional' && ltv > 80) {
    // Conventional PMI: roughly 0.2%–1.5% annually, simplified by LTV + FICO
    let annualRate = 0.01; // default 1%
    if (ltv <= 85) annualRate = creditScore >= 740 ? 0.003 : 0.006;
    else if (ltv <= 90) annualRate = creditScore >= 740 ? 0.006 : 0.01;
    else if (ltv <= 95) annualRate = creditScore >= 740 ? 0.009 : 0.013;
    else annualRate = creditScore >= 740 ? 0.012 : 0.016;
    return (loanAmount * annualRate) / 12;
  }
  return 0;
}

/**
 * Standard amortization — monthly principal + interest.
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 100 / 12;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

export function calculateTotalInterest(
  principal: number,
  annualRate: number,
  termMonths: number
): number {
  const monthly = calculateMonthlyPayment(principal, annualRate, termMonths);
  return Math.max(0, monthly * termMonths - principal);
}

/**
 * Rough cash-to-close: down payment + closing costs (default 3%).
 */
export function calculateCashToClose(
  downPayment: number,
  loanAmount: number,
  closingCostsPct = 0.03
): number {
  return downPayment + loanAmount * closingCostsPct;
}

// ─── APR Estimate ─────────────────────────────────────────────────────────────
// APR spreads above rate: includes origination, MIP amortized, title, etc.
function estimateAPR(
  rate: number,
  loanAmount: number,
  termMonths: number,
  monthlyMI: number
): number {
  const closingCosts = loanAmount * 0.015; // simplified origination
  const totalMI = monthlyMI * termMonths;
  const totalFinanced = loanAmount + closingCosts + totalMI;
  const payment = calculateMonthlyPayment(loanAmount, rate, termMonths);
  // Newton's method approximation — 3 iterations
  let r = rate / 100 / 12;
  for (let i = 0; i < 5; i++) {
    const f =
      totalFinanced * (r * Math.pow(1 + r, termMonths)) /
        (Math.pow(1 + r, termMonths) - 1) -
      payment;
    const df =
      totalFinanced *
      (Math.pow(1 + r, termMonths) * (1 + r * termMonths) -
        Math.pow(1 + r, termMonths)) /
        Math.pow(Math.pow(1 + r, termMonths) - 1, 2);
    r = r - f / df;
  }
  return Math.max(rate, r * 12 * 100);
}

// ─── Rate seed (indicative mid-market, clearly labeled) ──────────────────────
const PROGRAM_BASE_RATES: Record<LoanProgram, number> = {
  conventional: 6.875,
  fha: 6.625,
  va: 6.375,
  usda: 6.5,
  jumbo: 7.125,
  dscr: 7.625,
  bank_statement: 7.875,
  fha_203k: 7.25,
};

const CONFORMING_LIMIT = 806_500;

// ─── Eligibility Engine ───────────────────────────────────────────────────────

export function checkEligibility(params: EligibilityParams): EligibilityResult[] {
  const {
    creditScore,
    annualIncome,
    monthlyDebts,
    purchasePrice,
    downPaymentAmount,
    termMonths,
    vaEligible,
    rentalIncome = 0,
  } = params;

  const loanAmount = calculateLoanAmount(purchasePrice, downPaymentAmount);
  const ltv = calculateLTV(loanAmount, purchasePrice);
  const monthlyIncome = annualIncome / 12;

  const results: EligibilityResult[] = [];

  const PROGRAMS: LoanProgram[] = [
    'conventional',
    'fha',
    'va',
    'usda',
    'jumbo',
    'dscr',
    'bank_statement',
  ];

  for (const program of PROGRAMS) {
    let status: EligibilityStatus = 'eligible';
    let reason: string | undefined;

    const baseRate = PROGRAM_BASE_RATES[program];
    const rateSpread = ltv > 90 ? 0.25 : ltv > 80 ? 0.125 : 0;
    const ficoAdj =
      creditScore >= 760 ? -0.25 : creditScore >= 720 ? 0 : creditScore >= 680 ? 0.125 : 0.375;
    const midRate = baseRate + rateSpread + ficoAdj;
    const rateRangeLow = Math.round((midRate - 0.125) * 1000) / 1000;
    const rateRangeHigh = Math.round((midRate + 0.125) * 1000) / 1000;

    const monthlyPI = calculateMonthlyPayment(loanAmount, midRate, termMonths);
    const monthlyMI = calculateMI(loanAmount, ltv, program, creditScore);

    // Estimate taxes + insurance for PITI
    const monthlyTaxInsurance = (purchasePrice * 0.0125) / 12;
    const monthlyTotal = monthlyPI + monthlyMI + monthlyTaxInsurance;

    const dti = calculateDTI(monthlyDebts, monthlyIncome, monthlyTotal);
    const cashToClose = calculateCashToClose(downPaymentAmount, loanAmount);
    const totalInterest = calculateTotalInterest(loanAmount, midRate, termMonths);
    const apr = estimateAPR(midRate, loanAmount, termMonths, monthlyMI);

    // ── Program-specific rules ──
    if (program === 'fha') {
      if (creditScore < 580) {
        status = 'ineligible';
        reason = `FICO ${creditScore} below FHA minimum (580)`;
      } else if (creditScore < 620) {
        status = 'conditional';
        reason = 'Manual underwrite required for FICO < 620';
      } else if (ltv > 96.5) {
        status = 'ineligible';
        reason = `LTV ${ltv.toFixed(1)}% exceeds FHA max (96.5%)`;
      } else if (dti.back > 57) {
        status = 'ineligible';
        reason = `Back DTI ${dti.back.toFixed(1)}% exceeds FHA max (57%)`;
      } else if (dti.back > 50) {
        status = 'conditional';
        reason = 'DTI > 50% requires strong compensating factors';
      }
    } else if (program === 'conventional') {
      if (creditScore < 620) {
        status = 'ineligible';
        reason = `FICO ${creditScore} below conventional minimum (620)`;
      } else if (ltv > 97) {
        status = 'ineligible';
        reason = `LTV ${ltv.toFixed(1)}% exceeds conventional max (97%)`;
      } else if (dti.back > 50) {
        status = 'ineligible';
        reason = `Back DTI ${dti.back.toFixed(1)}% exceeds conventional max (50%)`;
      } else if (dti.back > 43) {
        status = 'conditional';
        reason = 'DTI 43–50% requires DU/LP AUS approval';
      }
    } else if (program === 'va') {
      if (!vaEligible) {
        status = 'ineligible';
        reason = 'VA eligibility not confirmed';
      } else if (creditScore < 580) {
        status = 'ineligible';
        reason = `FICO ${creditScore} below VA minimum (580)`;
      } else if (creditScore < 620) {
        status = 'conditional';
        reason = 'Manual underwrite required for FICO < 620';
      } else if (dti.back > 60) {
        status = 'conditional';
        reason = 'VA DTI > 60% requires residual income analysis';
      }
    } else if (program === 'usda') {
      if (creditScore < 640) {
        status = 'ineligible';
        reason = `FICO ${creditScore} below USDA GUS minimum (640)`;
      } else if (ltv > 100) {
        status = 'ineligible';
        reason = 'USDA does not allow cash-out above 100% LTV';
      } else if (loanAmount > 500_000) {
        status = 'ineligible';
        reason = 'Loan amount exceeds typical USDA income limits';
      } else if (dti.back > 46) {
        status = 'conditional';
        reason = 'DTI > 41% requires GUS approval';
      }
    } else if (program === 'jumbo') {
      if (loanAmount <= CONFORMING_LIMIT) {
        status = 'ineligible';
        reason = `Loan $${loanAmount.toLocaleString()} is at/below conforming limit ($${CONFORMING_LIMIT.toLocaleString()})`;
      } else if (creditScore < 700) {
        status = 'ineligible';
        reason = `FICO ${creditScore} below jumbo minimum (700)`;
      } else if (ltv > 80) {
        status = 'ineligible';
        reason = `LTV ${ltv.toFixed(1)}% exceeds jumbo max (80%)`;
      } else if (dti.back > 43) {
        status = 'ineligible';
        reason = `Back DTI ${dti.back.toFixed(1)}% exceeds jumbo max (43%)`;
      }
    } else if (program === 'dscr') {
      const dscr = rentalIncome > 0 ? rentalIncome / monthlyPI : 0;
      if (creditScore < 660) {
        status = 'ineligible';
        reason = `FICO ${creditScore} below DSCR minimum (660)`;
      } else if (ltv > 80) {
        status = 'ineligible';
        reason = `LTV ${ltv.toFixed(1)}% exceeds DSCR max (80%)`;
      } else if (rentalIncome <= 0) {
        status = 'conditional';
        reason = 'Rental income required — enter projected rent to calculate DSCR';
      } else if (dscr < 1.0) {
        status = 'conditional';
        reason = `DSCR ${dscr.toFixed(2)} < 1.0 — no-ratio DSCR product only`;
      }
    } else if (program === 'bank_statement') {
      if (creditScore < 620) {
        status = 'ineligible';
        reason = `FICO ${creditScore} below bank statement minimum (620)`;
      } else if (ltv > 85) {
        status = 'conditional';
        reason = 'LTV > 85% limits bank statement options';
      } else if (dti.back > 50) {
        status = 'conditional';
        reason = 'High DTI — income calculation subject to lender guidelines';
      }
    }

    results.push({
      program,
      status,
      reason,
      rateRangeLow,
      rateRangeHigh,
      apr: Math.round(apr * 1000) / 1000,
      monthlyPI: Math.round(monthlyPI * 100) / 100,
      monthlyMI: Math.round(monthlyMI * 100) / 100,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      cashToClose: Math.round(cashToClose),
      totalInterest: Math.round(totalInterest),
      frontDTI: Math.round(dti.front * 10) / 10,
      backDTI: Math.round(dti.back * 10) / 10,
      loanAmount: Math.round(loanAmount),
      ltv: Math.round(ltv * 10) / 10,
    });
  }

  // Sort: eligible first, then conditional, then ineligible
  const order: Record<EligibilityStatus, number> = { eligible: 0, conditional: 1, ineligible: 2 };
  results.sort((a, b) => order[a.status] - order[b.status]);

  return results;
}

// ─── DSCR Calculations ────────────────────────────────────────────────────────

export interface DSCRResult {
  dscr: number;
  tier: 'strong' | 'limited' | 'no_ratio';
  ineligible: boolean;
  cashFlowAfterDebt: number;
  maxLoanAmount: number;
  capRate: number | null;
  suggestedProgram: string;
}

export function calculateDSCR(params: {
  monthlyGrossRent: number;
  monthlyPITI: number;
  vacancyRatePct: number;
  managementPct: number;
  hoaMonthly: number;
  purchasePrice?: number;
}): DSCRResult {
  const {
    monthlyGrossRent,
    monthlyPITI,
    vacancyRatePct,
    managementPct,
    hoaMonthly,
    purchasePrice,
  } = params;

  const effectiveRent = monthlyGrossRent * (1 - vacancyRatePct / 100);
  const mgmtCost = effectiveRent * (managementPct / 100);
  const noi = effectiveRent - mgmtCost - hoaMonthly;
  const totalDebt = monthlyPITI;

  const dscr = totalDebt > 0 ? noi / totalDebt : 0;

  let tier: DSCRResult['tier'];
  let suggestedProgram: string;
  const ineligible = false;

  if (dscr >= 1.25) {
    tier = 'strong';
    suggestedProgram = 'Full DSCR — most DSCR lenders';
  } else if (dscr >= 1.0) {
    tier = 'limited';
    suggestedProgram = 'DSCR 1.0+ — limited lender set';
  } else {
    tier = 'no_ratio';
    suggestedProgram = 'No-Ratio DSCR or Debt Coverage Note';
  }

  const cashFlowAfterDebt = noi - totalDebt;
  // Max loan at DSCR 1.0: NOI / rate / 12 (approximate back-calculation)
  const approxRate = 0.07625 / 12;
  const termMonths = 360;
  const maxPayment = noi; // DSCR = 1.0
  const maxLoanAmount =
    approxRate > 0
      ? (maxPayment * (1 - Math.pow(1 + approxRate, -termMonths))) / approxRate
      : 0;

  const capRate =
    purchasePrice && purchasePrice > 0 ? (noi * 12) / purchasePrice : null;

  return {
    dscr: Math.round(dscr * 1000) / 1000,
    tier,
    ineligible,
    cashFlowAfterDebt: Math.round(cashFlowAfterDebt * 100) / 100,
    maxLoanAmount: Math.round(maxLoanAmount),
    capRate: capRate !== null ? Math.round(capRate * 10000) / 10000 : null,
    suggestedProgram,
  };
}

// ─── Bank Statement Income ────────────────────────────────────────────────────

export interface BankStatementResult {
  qualifying12mo: number;
  qualifying24mo: number;
  maxLoanAt43DTI: number;
}

export function calculateBankStatementIncome(params: {
  deposits12mo: number;
  deposits24mo: number;
  expenseRatioPct: number;
  existingMonthlyDebts: number;
}): BankStatementResult {
  const { deposits12mo, deposits24mo, expenseRatioPct, existingMonthlyDebts } = params;
  const expenseFactor = 1 - expenseRatioPct / 100;

  const qualifying12mo = (deposits12mo * expenseFactor) / 12;
  const qualifying24mo = (deposits24mo * expenseFactor) / 24;

  const availableForDebt43 = qualifying24mo * 0.43 - existingMonthlyDebts;
  const approxRate = 0.07875 / 12;
  const termMonths = 360;
  const maxLoanAt43DTI =
    availableForDebt43 > 0 && approxRate > 0
      ? (availableForDebt43 * (1 - Math.pow(1 + approxRate, -termMonths))) / approxRate
      : 0;

  return {
    qualifying12mo: Math.round(qualifying12mo * 100) / 100,
    qualifying24mo: Math.round(qualifying24mo * 100) / 100,
    maxLoanAt43DTI: Math.round(maxLoanAt43DTI),
  };
}

// ─── Asset Depletion ──────────────────────────────────────────────────────────

export interface AssetDepletionResult {
  monthlyDepletionIncome: number;
  totalQualifyingIncome: number;
  maxLoanAmount: number;
}

export function calculateAssetDepletion(params: {
  totalAssets: number;
  liabilities: number;
  remainingTermMonths: number;
  otherMonthlyIncome: number;
  existingMonthlyDebts: number;
}): AssetDepletionResult {
  const {
    totalAssets,
    liabilities,
    remainingTermMonths,
    otherMonthlyIncome,
    existingMonthlyDebts,
  } = params;

  const netAssets = Math.max(0, totalAssets - liabilities);
  // Most lenders use 70% of assets
  const usableAssets = netAssets * 0.7;
  const monthlyDepletionIncome =
    remainingTermMonths > 0 ? usableAssets / remainingTermMonths : 0;
  const totalQualifyingIncome = monthlyDepletionIncome + otherMonthlyIncome;

  const availableForDebt = totalQualifyingIncome * 0.43 - existingMonthlyDebts;
  const approxRate = 0.075 / 12;
  const termMonths = 360;
  const maxLoanAmount =
    availableForDebt > 0 && approxRate > 0
      ? (availableForDebt * (1 - Math.pow(1 + approxRate, -termMonths))) / approxRate
      : 0;

  return {
    monthlyDepletionIncome: Math.round(monthlyDepletionIncome * 100) / 100,
    totalQualifyingIncome: Math.round(totalQualifyingIncome * 100) / 100,
    maxLoanAmount: Math.round(maxLoanAmount),
  };
}

// ─── P&L / 1099 ───────────────────────────────────────────────────────────────

export interface PLQualifierResult {
  twoYearAvg: number;
  adjustedIncome: number;
  maxLoanAmount: number;
}

export function calculatePLQualifier(params: {
  year1NetIncome: number;
  year2NetIncome: number;
  ownershipPct: number;
  depreciation: number;
  otherAddbacks: number;
  existingMonthlyDebts: number;
}): PLQualifierResult {
  const {
    year1NetIncome,
    year2NetIncome,
    ownershipPct,
    depreciation,
    otherAddbacks,
    existingMonthlyDebts,
  } = params;

  const ownership = ownershipPct / 100;
  const avg = ((year1NetIncome + year2NetIncome) / 2) * ownership;
  const annualAddbacks = (depreciation + otherAddbacks) * ownership;
  const adjustedAnnual = avg + annualAddbacks;
  const adjustedMonthly = adjustedAnnual / 12;

  const availableForDebt = adjustedMonthly * 0.43 - existingMonthlyDebts;
  const approxRate = 0.075 / 12;
  const termMonths = 360;
  const maxLoanAmount =
    availableForDebt > 0 && approxRate > 0
      ? (availableForDebt * (1 - Math.pow(1 + approxRate, -termMonths))) / approxRate
      : 0;

  return {
    twoYearAvg: Math.round(avg / 12 * 100) / 100,
    adjustedIncome: Math.round(adjustedMonthly * 100) / 100,
    maxLoanAmount: Math.round(maxLoanAmount),
  };
}

// ─── Fix & Flip ───────────────────────────────────────────────────────────────

export interface FixFlipResult {
  estimatedProfit: number;
  maxLoan: number;
  estimatedROI: number;
  bridgeLoanSize: number;
  totalCost: number;
}

export function calculateFixFlip(params: {
  purchasePrice: number;
  arv: number;
  rehabBudget: number;
  holdMonths: number;
  carryingCostsPerMonth: number;
}): FixFlipResult {
  const { purchasePrice, arv, rehabBudget, holdMonths, carryingCostsPerMonth } = params;

  const totalCarrying = holdMonths * carryingCostsPerMonth;
  const totalCost = purchasePrice + rehabBudget + totalCarrying;
  const estimatedProfit = arv - totalCost;

  // 90% LTC or 70% ARV — use lower
  const maxByLTC = totalCost * 0.9;
  const maxByARV = arv * 0.7;
  const maxLoan = Math.min(maxByLTC, maxByARV);

  const estimatedROI = totalCost > 0 ? (estimatedProfit / totalCost) * 100 : 0;

  // Bridge loan: typically covers acquisition + rehab
  const bridgeLoanSize = Math.min((purchasePrice + rehabBudget) * 0.9, arv * 0.7);

  return {
    estimatedProfit: Math.round(estimatedProfit),
    maxLoan: Math.round(maxLoan),
    estimatedROI: Math.round(estimatedROI * 10) / 10,
    bridgeLoanSize: Math.round(bridgeLoanSize),
    totalCost: Math.round(totalCost),
  };
}

// ─── Commercial NOI ───────────────────────────────────────────────────────────

export interface CommercialNOIResult {
  effectiveGrossIncome: number;
  noi: number;
  capRate: number | null;
  valueAtCapRate: number | null;
  dscr: number | null;
}

export function calculateCommercialNOI(params: {
  grossRentalIncome: number;
  vacancyRatePct: number;
  propertyTax: number;
  insurance: number;
  maintenance: number;
  management: number;
  utilities: number;
  capexReserve: number;
  purchasePrice?: number;
  annualDebtService?: number;
  marketCapRate?: number;
}): CommercialNOIResult {
  const {
    grossRentalIncome,
    vacancyRatePct,
    propertyTax,
    insurance,
    maintenance,
    management,
    utilities,
    capexReserve,
    purchasePrice,
    annualDebtService,
    marketCapRate,
  } = params;

  const effectiveGrossIncome = grossRentalIncome * (1 - vacancyRatePct / 100);
  const totalExpenses = propertyTax + insurance + maintenance + management + utilities + capexReserve;
  const noi = effectiveGrossIncome - totalExpenses;

  const capRate = purchasePrice && purchasePrice > 0 ? noi / purchasePrice : null;
  const valueAtCapRate =
    marketCapRate && marketCapRate > 0 ? noi / (marketCapRate / 100) : null;
  const dscr = annualDebtService && annualDebtService > 0 ? noi / annualDebtService : null;

  return {
    effectiveGrossIncome: Math.round(effectiveGrossIncome * 100) / 100,
    noi: Math.round(noi * 100) / 100,
    capRate: capRate !== null ? Math.round(capRate * 10000) / 10000 : null,
    valueAtCapRate: valueAtCapRate !== null ? Math.round(valueAtCapRate) : null,
    dscr: dscr !== null ? Math.round(dscr * 1000) / 1000 : null,
  };
}

// ─── SBA Recommendation ───────────────────────────────────────────────────────

export interface SBAResult {
  recommendation: '7a' | '504' | 'neither';
  eligibleAmount: number;
  requiredEquity: number;
  estimated10yrPayment: number;
  estimated25yrPayment: number;
  reason: string;
}

export function calculateSBA(params: {
  projectCost: number;
  realEstatePct: number;
  businessRevenue: number;
  existingDebt: number;
}): SBAResult {
  const { projectCost, realEstatePct, businessRevenue, existingDebt } = params;
  void businessRevenue;
  void existingDebt;

  const realEstateAmount = projectCost * (realEstatePct / 100);
  const is504Eligible = realEstatePct >= 50 && projectCost >= 500_000;

  // 504: up to $5M, requires 10% equity; 7(a): up to $5M, requires 10-20% equity
  const maxSBA = Math.min(projectCost, 5_000_000);
  const equityPct = is504Eligible ? 0.1 : 0.15;
  const requiredEquity = projectCost * equityPct;
  const eligibleAmount = Math.min(maxSBA - requiredEquity, projectCost - requiredEquity);

  const rate7a = 0.1025; // Prime + 2.75% approximate
  const rate504 = 0.0675; // CDC debenture approximate

  const estimated10yrPayment = calculateMonthlyPayment(eligibleAmount, rate7a * 100, 120);
  const estimated25yrPayment = calculateMonthlyPayment(
    realEstateAmount * 0.9,
    rate504 * 100,
    300
  );

  return {
    recommendation: is504Eligible ? '504' : '7a',
    eligibleAmount: Math.round(eligibleAmount),
    requiredEquity: Math.round(requiredEquity),
    estimated10yrPayment: Math.round(estimated10yrPayment * 100) / 100,
    estimated25yrPayment: Math.round(estimated25yrPayment * 100) / 100,
    reason: is504Eligible
      ? 'SBA 504 preferred — real estate ≥ 50% of project, lower rate on fixed-asset portion'
      : 'SBA 7(a) — flexible use of proceeds, working capital allowed',
  };
}
