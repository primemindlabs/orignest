/**
 * Phase 121 — Referral partner heat (momentum). Reuses the Phase 95 realtor heat
 * math (computeHeatScore / bandForScore) so bands are consistent across the app.
 * Partner signals: referrals submitted in the last 90/180 days + recency of the
 * LO's last outreach. There is no "meeting" signal for non-Realtor partners.
 */
import { computeHeatScore, bandForScore, type HeatBand } from '@/lib/realtors/heatScore';

export type { HeatBand };
export { bandForScore };

export function computePartnerHeat(input: {
  referrals_90d: number;
  referrals_180d: number;
  last_outreach_at: string | null;
}): { score: number; band: HeatBand; top_signal: string } {
  const days =
    input.last_outreach_at == null
      ? null
      : Math.floor((Date.now() - new Date(input.last_outreach_at).getTime()) / 86_400_000);
  const r = computeHeatScore({
    deals_90d: input.referrals_90d,
    deals_180d: input.referrals_180d,
    days_since_last_contact: days,
    had_meeting_last_30d: false,
  });
  return { score: r.score, band: r.band, top_signal: r.top_signal };
}
