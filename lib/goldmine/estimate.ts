/** Phase 131 — Goldmine financial estimates (pure). */

const N = 360; // 30-year amortization

function monthlyPI(loanAmount: number, annualRatePct: number): number {
  const r = annualRatePct / 100 / 12;
  if (r <= 0) return loanAmount / N;
  return (loanAmount * (r * Math.pow(1 + r, N))) / (Math.pow(1 + r, N) - 1);
}

/** Estimated monthly P&I savings refinancing from oldRate to newRate (whole dollars). */
export function estimateMonthlySavings(loanAmount: number | null, oldRate: number | null, newRate: number | null): number {
  if (!loanAmount || !oldRate || !newRate || oldRate <= newRate) return 0;
  return Math.max(0, Math.round(monthlyPI(loanAmount, oldRate) - monthlyPI(loanAmount, newRate)));
}

/** Rough LO comp on a loan: loan_amount × comp_rate% (defaults to ~1.0% if unknown). */
export function estimateComp(loanAmount: number | null, compRatePct: number | null): number | null {
  if (!loanAmount) return null;
  const rate = compRatePct != null && compRatePct > 0 ? compRatePct : 1.0;
  return Math.round((loanAmount * rate) / 100);
}

/** Returns 1, 3, or 5 if a funding date hits that anniversary within the next 14 days; else null. */
export function getLoanAnniversary(fundedAt: string | null, today = new Date()): number | null {
  if (!fundedAt) return null;
  const funded = new Date(fundedAt + (fundedAt.length === 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(funded.getTime())) return null;
  for (const yrs of [1, 3, 5]) {
    const anniv = new Date(funded.getFullYear() + yrs, funded.getMonth(), funded.getDate());
    const diffDays = (anniv.getTime() - today.getTime()) / 86_400_000;
    if (diffDays >= -1 && diffDays <= 14) return yrs;
  }
  return null;
}
