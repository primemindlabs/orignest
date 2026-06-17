// Phase 142 — Product & Pricing Engine: shared types.
// The normalized contract every pricing source returns, so ingested rate sheets
// and a licensed PPE (Optimal Blue, etc.) merge into one best-execution view.

export interface PricingScenario {
  loanType: string;            // 'conventional' | 'fha' | 'va' | 'usda' | 'jumbo' | 'dscr' | 'non_qm_*'
  termYears: number;           // 30, 20, 15…
  loanAmount: number;
  propertyValue: number;
  ltv: number;                 // %, 0–100+
  fico: number;
  loanPurpose: string | null;  // 'purchase' | 'rate_term_refinance' | 'cash_out_refinance'
  occupancy: string | null;    // 'primary' | 'second_home' | 'investment'
  propertyType: string | null; // 'single_family' | 'condo' | 'multi_family' …
  lockDays: number;            // 15 | 30 | 45 | 60
  dti?: number | null;
  state?: string | null;
}

/** §1026.36(e)(3) risky features that disqualify a loan from the "safe" option. */
export interface RiskyFeatures {
  negativeAmortization: boolean;
  prepaymentPenalty: boolean;
  interestOnly: boolean;
  balloon: boolean;
}

export function hasRiskyFeature(r: RiskyFeatures): boolean {
  return r.negativeAmortization || r.prepaymentPenalty || r.interestOnly || r.balloon;
}

/** A single priced, eligible product — normalized across all sources. */
export interface PricedProduct {
  id: string;                  // stable per source row (sourceId:rowId)
  sourceId: string;            // 'rate_sheet' | 'optimal_blue' | …
  sourceLabel: string;         // human label for the source
  lenderName: string;
  productName: string;         // "30 Yr Fixed"
  loanType: string;
  termYears: number;
  amortizationType: string;    // 'fixed' | 'arm' | 'io' …
  noteRate: number;            // %
  basePrice: number;           // points; 100.000 = par
  totalAdjustment: number;     // summed LLPAs in price points
  adjustedPrice: number;       // basePrice + totalAdjustment (higher = lower cost)
  lockDays: number;
  monthlyPI: number;
  risky: RiskyFeatures;
  appliedAdjustments: { name: string; amount: number }[];
  asOf: string | null;         // effective date / quote timestamp
  stale: boolean;              // expired sheet or quote past freshness window
}

export interface IneligibleProduct {
  lenderName: string;
  productName: string;
  sourceLabel: string;
  reasons: string[];
}

export interface SourceStatus {
  id: string;
  label: string;
  status: 'ok' | 'gated' | 'empty' | 'error';
  note?: string;
  eligibleCount: number;
}

/** The three loan options the anti-steering safe harbor (§1026.36(e)(3)) requires. */
export interface AntiSteeringOptions {
  lowestRate: PricedProduct | null;
  lowestRateNoRiskyFeatures: PricedProduct | null;
  lowestTotalCost: PricedProduct | null;
}

export interface BestExResult {
  priced: PricedProduct[];                  // eligible, ranked (least cost first)
  ineligible: IneligibleProduct[];
  antiSteering: AntiSteeringOptions;
  sources: SourceStatus[];
  generatedAt: string;
  anyStale: boolean;
}

/** What a source returns to the engine. */
export interface SourceResult {
  status: SourceStatus;
  eligible: PricedProduct[];
  ineligible: IneligibleProduct[];
}
