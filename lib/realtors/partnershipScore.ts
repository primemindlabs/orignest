/**
 * Phase 40.3 — partnership score (0–100) + tier. Pure function (no DB).
 * production (0–40) + buyer-focus (0–20) + relationship (0–25) + recency (0–15).
 */

export type PartnershipTier = 'prospect' | 'developing' | 'active_partner' | 'top_partner' | 'dormant';

export interface RealtorScoreInput {
  transactions_12m?: number | null;
  volume_12m?: number | null;
  buyer_side_pct?: number | null;
  deals_referred_12m?: number | null;
  last_attom_sync?: string | null;
  last_contact_at?: string | null;
  last_referral_at?: string | null;
}

export interface ScoreFactors {
  production_score: number;
  buyer_focus_score: number;
  relationship_score: number;
  recency_score: number;
}

function daysSince(d?: string | null): number {
  if (!d) return 365;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

function scoreProduction(tx: number, volume: number): number {
  // Transaction-count tiers (a proxy for market rank) + a small volume bonus.
  let s = tx >= 50 ? 36 : tx >= 30 ? 30 : tx >= 20 ? 24 : tx >= 10 ? 16 : tx >= 5 ? 8 : tx > 0 ? 4 : 0;
  if (volume >= 25_000_000) s += 4;
  else if (volume >= 10_000_000) s += 2;
  return Math.min(40, s);
}

export function computePartnershipScore(r: RealtorScoreInput): { score: number; factors: ScoreFactors; tier: PartnershipTier } {
  const tx = r.transactions_12m ?? 0;
  const volume = Number(r.volume_12m ?? 0);
  const buyerPct = r.buyer_side_pct ?? 0;
  const referred = r.deals_referred_12m ?? 0;

  const production_score = scoreProduction(tx, volume);
  const buyer_focus_score = buyerPct >= 60 ? 20 : buyerPct >= 40 ? 10 : 5;
  const relationship_score = Math.min(25, referred * 5);
  const d = daysSince(r.last_attom_sync);
  const recency_score = d < 30 ? 15 : d < 90 ? 10 : d < 180 ? 5 : 0;

  const score = Math.min(100, production_score + buyer_focus_score + relationship_score + recency_score);

  const tier: PartnershipTier =
    referred >= 5 ? 'top_partner'
    : referred >= 2 ? 'active_partner'
    : r.last_contact_at && daysSince(r.last_contact_at) < 90 ? 'developing'
    : r.last_referral_at && daysSince(r.last_referral_at) > 180 ? 'dormant'
    : 'prospect';

  return { score, factors: { production_score, buyer_focus_score, relationship_score, recency_score }, tier };
}

export const TIER_LABELS: Record<PartnershipTier, string> = {
  prospect: 'Prospect', developing: 'Developing', active_partner: 'Active Partner', top_partner: 'Top Partner', dormant: 'Dormant',
};
export const TIER_COLORS: Record<PartnershipTier, string> = {
  prospect: '#6B7B8D', developing: '#4A90D9', active_partner: '#27AE60', top_partner: 'var(--c-gold)', dormant: '#E67E22',
};
