/**
 * Phase 48.2 — LO ↔ realtor compatibility (0–100). Six weighted, explainable
 * factors. Pure function (no DB, client+server).
 */
export type MatchTier = 'perfect' | 'strong' | 'good' | 'possible';

export interface MatchFactor { name: string; score: number; weight: number; label: string }
export interface MatchScoreResult { score: number; tier: MatchTier; factors: MatchFactor[]; headline: string; opportunity: string }

export interface LOProfile { primary_zip_codes: string[]; avg_loan_amount: number; strong_loan_types: string[] }
export interface CandidateProfile {
  first_name?: string | null; primary_zip_codes?: string[] | null; avg_sale_price?: number | null;
  transactions_12m?: number | null; buyer_side_pct?: number | null; top_lender_share?: number | null;
}

function geography(loZips: string[], rZips: string[]): MatchFactor {
  const overlap = loZips.filter((z) => rZips.includes(z)).length;
  const max = Math.min(loZips.length || 1, rZips.length || 1);
  const pct = max > 0 ? overlap / max : 0;
  return { name: 'geography', score: Math.round(pct * 100), weight: 0.25, label: overlap > 0 ? `Works in ${overlap} of your top zip code${overlap > 1 ? 's' : ''}` : 'No zip overlap — different market' };
}
function priceRange(loAvgLoan: number, rAvgSale: number): MatchFactor {
  const implied = (rAvgSale || 0) * 0.8;
  const ratio = loAvgLoan && implied ? Math.min(loAvgLoan, implied) / Math.max(loAvgLoan, implied) : 0;
  return { name: 'price_range', score: Math.round(ratio * 100), weight: 0.2, label: ratio > 0.85 ? `Price range aligns ($${(rAvgSale / 1000).toFixed(0)}K avg sale)` : ratio > 0.6 ? 'Some price-range overlap' : `Price diverges — $${(rAvgSale / 1000).toFixed(0)}K avg sale` };
}
function volume(tx: number): MatchFactor {
  const s = tx >= 24 ? 100 : tx >= 12 ? 70 + ((tx - 12) / 12) * 30 : tx >= 6 ? 40 + ((tx - 6) / 6) * 30 : (tx / 6) * 40;
  return { name: 'volume', score: Math.round(s), weight: 0.2, label: `${tx} closed deals in last 12 months` };
}
function buyerSide(pct: number): MatchFactor {
  // pct stored 0–1; buyer agents send referrals, listing agents rarely do.
  const p = pct > 1 ? pct / 100 : pct;
  const s = Math.round(Math.min(1, p / 0.7) * 100);
  return { name: 'buyer_side', score: s, weight: 0.15, label: `${Math.round(p * 100)}% buyer-side` };
}
function loanTypeFit(strong: string[]): MatchFactor {
  // Without per-deal loan-type data on the prospect, credit the LO having defined strengths.
  const s = strong.length ? 70 : 50;
  return { name: 'loan_type', score: s, weight: 0.1, label: strong.length ? `Your strengths: ${strong.slice(0, 3).join(', ')}` : 'General product fit' };
}
function competitiveGap(topLenderShare: number | null): MatchFactor {
  // High incumbent share = clearer opening to displace.
  const share = topLenderShare ?? 0;
  const s = share >= 0.3 ? 90 : share >= 0.2 ? 70 : share > 0 ? 50 : 50;
  return { name: 'competitive_gap', score: s, weight: 0.1, label: share > 0 ? `Top lender holds ${Math.round(share * 100)}% — room to win` : 'Competitive landscape unknown' };
}

export function computeMatchScore(lo: LOProfile, r: CandidateProfile): MatchScoreResult {
  const factors = [
    geography(lo.primary_zip_codes ?? [], r.primary_zip_codes ?? []),
    priceRange(lo.avg_loan_amount ?? 0, Number(r.avg_sale_price ?? 0)),
    volume(r.transactions_12m ?? 0),
    buyerSide(Number(r.buyer_side_pct ?? 0)),
    loanTypeFit(lo.strong_loan_types ?? []),
    competitiveGap(r.top_lender_share ?? null),
  ];
  const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
  const tier: MatchTier = score >= 80 ? 'perfect' : score >= 65 ? 'strong' : score >= 45 ? 'good' : 'possible';

  const geo = factors[0], buy = factors[3];
  const name = r.first_name ?? 'This agent';
  const headline = tier === 'perfect' ? 'Perfect match — pursue now'
    : tier === 'strong' ? `Strong match${buy.score >= 70 ? ' — buyer-focused agent in your range' : ''}`
    : tier === 'good' ? 'Good potential — worth an intro' : 'Possible fit';
  const opportunity = `${name} closes ${r.transactions_12m ?? 0} deals/yr${geo.score > 0 ? ` in your market` : ''}${buy.score >= 70 ? ' and works mostly with buyers' : ''} — a natural referral partner.`;

  return { score, tier, factors, headline, opportunity };
}

export const TIER_STYLE: Record<MatchTier, { label: string; color: string }> = {
  perfect: { label: 'PERFECT', color: '#27AE60' }, strong: { label: 'STRONG', color: 'var(--c-gold)' },
  good: { label: 'GOOD', color: '#4A90D9' }, possible: { label: 'POSSIBLE', color: '#6B7B8D' },
};
