/**
 * Phase 59.3 — VA funding fee. PURE. 2024 purchase/cash-out table. Exempt (10%+
 * disability rating or eligible surviving spouse) → 0. IRRRL is a flat 0.5%.
 */
export interface VAFundingFeeResult { exempt: boolean; fee_pct: number; fee_amount: number }

export function calculateVAFundingFee(params: { loanAmount: number; downPaymentPct: number; firstUse: boolean; exempt?: boolean; loanType?: 'purchase' | 'irrrl' | 'cash_out' }): VAFundingFeeResult {
  if (params.exempt) return { exempt: true, fee_pct: 0, fee_amount: 0 };
  if (params.loanType === 'irrrl') return { exempt: false, fee_pct: 0.5, fee_amount: Math.round(params.loanAmount * 0.005) };

  const dp = params.downPaymentPct;
  let pct: number;
  if (dp >= 10) pct = 1.4;
  else if (dp >= 5) pct = 1.65;
  else pct = params.firstUse ? 2.3 : 3.6; // 0% down
  return { exempt: false, fee_pct: pct, fee_amount: Math.round(params.loanAmount * pct / 100) };
}
