// Phase 104 — rate-lock extension cost estimate. PURE / testable.
//
// Verification cases (from spec):
//   BPS=4,   days=10, balance=$490,000 → bpsTotal=40,   cost=$1,960
//   BPS=2,   days=7,  balance=$350,000 → bpsTotal=14,   cost=$490
//   BPS=2.5, days=15, balance=$600,000 → bpsTotal=37.5, cost=$2,250
//   BPS=0 → rejected server-side (bps_per_day must be > 0)

export interface ExtensionCostResult {
  totalCostDollars: number;
  bpsTotal: number;
}

export function estimateExtensionCost(params: {
  bpsPerDay: number;
  daysRequested: number;
  loanBalance: number;
}): ExtensionCostResult {
  const bpsTotal = params.bpsPerDay * params.daysRequested;
  const totalCostDollars = Math.round((bpsTotal / 10000) * params.loanBalance);
  return { totalCostDollars, bpsTotal };
}
