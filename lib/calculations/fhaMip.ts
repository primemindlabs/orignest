/**
 * Phase 59.3 — FHA MIP. PURE. Upfront MIP is always 1.75%. Annual MIP + duration
 * vary by LTV (base case: loan ≤ $726,200, 30-year term).
 */
export interface FHAMipResult { upfront_mip_pct: number; upfront_mip_amount: number; annual_mip_pct: number; annual_mip_duration: 'life_of_loan' | '11_years'; mip_monthly: number }

export function calculateFHAMip(loanAmount: number, ltv: number): FHAMipResult {
  const upfrontPct = 1.75;
  let annualPct: number; let duration: 'life_of_loan' | '11_years';
  if (ltv <= 90) { annualPct = 0.5; duration = '11_years'; }
  else if (ltv <= 95) { annualPct = 0.5; duration = 'life_of_loan'; }
  else { annualPct = 0.55; duration = 'life_of_loan'; }
  return {
    upfront_mip_pct: upfrontPct, upfront_mip_amount: Math.round(loanAmount * upfrontPct / 100),
    annual_mip_pct: annualPct, annual_mip_duration: duration,
    mip_monthly: Math.round((loanAmount * annualPct / 100) / 12),
  };
}
