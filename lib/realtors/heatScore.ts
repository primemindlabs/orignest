/**
 * Phase 95 — Realtor Heat Score.
 *
 * Heat (momentum) is distinct from the Phase 40 partnership_score (capacity):
 * it rewards recent contact + recent/closing deal velocity so the LO knows which
 * relationships need a touch NOW.
 *
 * `computeHeatScore` is a pure function (shared by API + any SSR). The DB-bound
 * recalc adapts to the real stack: realtors are org-scoped (not auth.users),
 * deals are leads with referral_realtor_id + stage='closed', the interaction log
 * is realtor_touches ('in_person' = the meeting/coffee signal), and recency comes
 * from realtors.last_contact_at (kept current by the touch route).
 */
import { createAdminClient } from '@/lib/supabase/admin';

export type HeatBand = 'hot' | 'warm' | 'cooling' | 'cold';

export interface HeatScoreInput {
  deals_90d: number;
  deals_180d: number;
  days_since_last_contact: number | null; // null = never contacted
  had_meeting_last_30d: boolean; // any 'in_person' touch in the last 30 days
}

export interface HeatScoreResult {
  score: number;
  band: HeatBand;
  deals_90d_score: number;
  recency_score: number;
  deal_trend_score: number;
  meeting_bonus: number;
  top_signal: string;
}

export function bandForScore(score: number): HeatBand {
  if (score >= 75) return 'hot';
  if (score >= 50) return 'warm';
  if (score >= 25) return 'cooling';
  return 'cold';
}

export function computeHeatScore(input: HeatScoreInput): HeatScoreResult {
  const { deals_90d, deals_180d, days_since_last_contact, had_meeting_last_30d } = input;

  // Factor 1 — deals closed in last 90 days (max 40): 20 pts each, capped.
  const deals_90d_score = Math.min(deals_90d * 20, 40);

  // Factor 2 — recency of last contact (max 30): 30 today, −1/day, floor 0.
  // null (never contacted) = 0.
  const recency_score =
    days_since_last_contact === null ? 0 : Math.max(30 - days_since_last_contact, 0);

  // Factor 3 — deal trend (0 or 20): recent-half rate beats the 180d average.
  const baseline_90d = deals_180d / 2;
  const deal_trend_score = deals_90d > baseline_90d ? 20 : 0;

  // Factor 4 — in-person meeting bonus (0 or 10).
  const meeting_bonus = had_meeting_last_30d ? 10 : 0;

  const score = Math.min(deals_90d_score + recency_score + deal_trend_score + meeting_bonus, 100);
  const band = bandForScore(score);

  let top_signal: string;
  if (deals_90d_score === 40) {
    top_signal = `${deals_90d} deals closed in the last 90 days`;
  } else if (deal_trend_score === 20 && deals_90d > 0) {
    top_signal = 'Deal volume trending up vs. the prior 90 days';
  } else if (meeting_bonus === 10) {
    top_signal = 'Met in person in the last 30 days';
  } else if (recency_score >= 20) {
    top_signal = `Contacted ${days_since_last_contact} day${days_since_last_contact === 1 ? '' : 's'} ago`;
  } else if (deals_90d > 0) {
    top_signal = `${deals_90d} deal${deals_90d === 1 ? '' : 's'} closed in 90 days`;
  } else {
    top_signal = 'No recent activity — schedule a touchpoint';
  }

  return { score, band, deals_90d_score, recency_score, deal_trend_score, meeting_bonus, top_signal };
}

// ── DB-bound recalc ──────────────────────────────────────────────────────────

type Admin = ReturnType<typeof createAdminClient>;

const DAY = 86_400_000;

export interface RealtorForHeat {
  id: string;
  org_id: string;
  last_contact_at: string | null;
}

/**
 * Recalculate and upsert the heat score for one realtor. Idempotent: always
 * upserts on realtor_id, so repeated runs converge to the same row.
 */
export async function recalcRealtorHeatScore(sb: Admin, realtor: RealtorForHeat): Promise<HeatScoreResult> {
  const now = Date.now();
  const ago30 = new Date(now - 30 * DAY).toISOString();

  // Deals: closed leads attributed to this realtor. Window on closing_date when
  // present (the true "closed" date), else created_at. Small N per realtor, so
  // we fetch and bucket in JS rather than two count queries.
  const { data: closedLeads } = await sb
    .from('leads')
    .select('closing_date, created_at')
    .eq('referral_realtor_id', realtor.id)
    .eq('stage', 'closed');

  let deals_90d = 0;
  let deals_180d = 0;
  for (const l of closedLeads ?? []) {
    const when = new Date((l.closing_date ?? l.created_at) as string).getTime();
    if (isNaN(when)) continue;
    const ageDays = (now - when) / DAY;
    if (ageDays <= 180) deals_180d += 1;
    if (ageDays <= 90) deals_90d += 1;
  }

  // Recency: realtors.last_contact_at is maintained by the touch route.
  let days_since_last_contact: number | null = null;
  if (realtor.last_contact_at) {
    const d = Math.floor((now - new Date(realtor.last_contact_at).getTime()) / DAY);
    days_since_last_contact = d >= 0 ? d : 0;
  }

  // Meeting bonus: any in-person touch in the last 30 days.
  const { count: meetingCount } = await sb
    .from('realtor_touches')
    .select('id', { count: 'exact', head: true })
    .eq('realtor_id', realtor.id)
    .eq('touch_type', 'in_person')
    .gte('created_at', ago30);

  const result = computeHeatScore({
    deals_90d,
    deals_180d,
    days_since_last_contact,
    had_meeting_last_30d: (meetingCount ?? 0) > 0,
  });

  await sb.from('realtor_heat_scores').upsert(
    {
      realtor_id: realtor.id,
      org_id: realtor.org_id,
      score: result.score,
      band: result.band,
      deals_90d,
      deals_180d,
      days_since_last_contact,
      driving_factors: {
        deals_90d_score: result.deals_90d_score,
        recency_score: result.recency_score,
        deal_trend_score: result.deal_trend_score,
        meeting_bonus: result.meeting_bonus,
        top_signal: result.top_signal,
      },
      calculated_at: new Date().toISOString(),
    },
    { onConflict: 'realtor_id' },
  );

  return result;
}

/** Fetch the realtor row first (org-scoped), then recalc. Returns null if not found. */
export async function recalcRealtorHeatScoreById(
  sb: Admin,
  realtorId: string,
  orgId: string,
): Promise<HeatScoreResult | null> {
  const { data: realtor } = await sb
    .from('realtors')
    .select('id, org_id, last_contact_at')
    .eq('id', realtorId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!realtor) return null;
  return recalcRealtorHeatScore(sb, realtor as RealtorForHeat);
}
