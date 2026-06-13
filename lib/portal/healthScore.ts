// Phase 123 — Mortgage Health Score. PURE (0–100) + action items.
// Credit (≤40) + LTV (≤30) + rate-vs-market (≤20) + payment history (10).

export interface HealthInputs {
  creditScore: number | null;
  ltv: number | null; // decimal (0.8) or percent (80) — normalized here
  currentRate: number | null;
  marketRate: number | null;
  hasPmi?: boolean;
  monthlyLoanBalance?: number | null;
}
export interface ActionItem { type: string; label: string; points_potential: number }
export interface HealthResult {
  score: number;
  credit_score: number | null;
  current_rate: number | null;
  market_rate: number | null;
  rate_comparison_delta: number | null;
  action_items: ActionItem[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function computeHealthScore(i: HealthInputs): HealthResult {
  const credit = i.creditScore;
  const ltv = i.ltv == null ? null : i.ltv > 1.5 ? i.ltv / 100 : i.ltv;
  const cur = i.currentRate;
  const mkt = i.marketRate;

  // Credit (≤40): neutral 20 when unknown.
  const creditComponent = credit == null ? 20 : clamp(((credit - 580) / (850 - 580)) * 40, 0, 40);
  // LTV (≤30): ≤0.70 = full; neutral 18 when unknown.
  const ltvComponent = ltv == null ? 18 : clamp((1 - ltv) * 30 + (ltv <= 0.7 ? 9 : 0), 0, 30);
  // Rate vs market (≤20): within 0.5% = full; else scale down.
  const delta = cur != null && mkt != null ? Math.round((cur - mkt) * 1000) / 1000 : null;
  const rateComponent = delta == null ? 12 : delta <= 0.5 ? 20 : clamp(20 - (delta - 0.5) * 10, 0, 20);
  // Payment history (10): assumed clean (no late-payment signal stored).
  const paymentComponent = 10;

  const score = clamp(Math.round(creditComponent + ltvComponent + rateComponent + paymentComponent), 0, 100);

  const actionItems: ActionItem[] = [];
  if (credit != null && credit < 740) actionItems.push({ type: 'credit', label: 'Pay down revolving balances to lift your score', points_potential: clamp(Math.round((740 - credit) / 10), 1, 12) });
  if (delta != null && delta > 0.5) {
    const balance = i.monthlyLoanBalance ?? 0;
    const est = Math.round((delta * balance) / 12 * 0.8);
    actionItems.push({ type: 'refinance', label: est > 0 ? `Refinance may be available — potential savings ~$${est.toLocaleString()}/mo` : 'Refinance may be available — ask your loan officer', points_potential: 5 });
  }
  if (ltv != null && ltv < 0.8 && i.hasPmi) actionItems.push({ type: 'pmi', label: 'PMI removal may be available — request a review', points_potential: 3 });
  if (actionItems.length === 0) actionItems.push({ type: 'maintain', label: 'You’re in great shape — keep payments on time to protect your score', points_potential: 0 });

  return { score, credit_score: credit, current_rate: cur, market_rate: mkt, rate_comparison_delta: delta, action_items: actionItems };
}
