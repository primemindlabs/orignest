// Phase 110 — Borrower Relationship Heat Score. Borrower analog of the Phase 95
// realtor heat score. PURE compute + DB-bound recalc.
//
// Formula (spec):
//   Contact recency (0–30): ≤7d=30, ≤30=20, ≤90=10, else 0
//   Portal engagement (0–25): login ≤7d=25, ≤30=15, ≤90=5, never/older=0
//   Life-event proximity (0–20): within 30d=20, within 60d=10, else 0
//   Referrals sent (0–15): 2+=15, 1=10, 0=0
//   Post-close recency (0–10): ≤12mo=10, ≤24mo=5, else 0
//   band: ≥70 hot · ≥45 warm · ≥20 cooling · else cold
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeLifeEventProximity } from '@/lib/borrowerHeat/lifeEventProximity';

type Admin = SupabaseClient<any, any, any>;
const DAY = 86_400_000;

export type HeatBand = 'hot' | 'warm' | 'cooling' | 'cold';

export interface BorrowerHeatInput {
  days_since_last_contact: number | null;
  days_since_portal_login: number | null;
  days_since_close: number | null;
  life_event_days_away: number | null; // null = none upcoming
  referrals_sent: number;
}

export interface BorrowerHeatResult {
  score: number;
  band: HeatBand;
  components: {
    contact: number;
    portal: number;
    life_event: number;
    referrals: number;
    post_close: number;
  };
  top_signal: string;
}

export function bandForScore(score: number): HeatBand {
  if (score >= 70) return 'hot';
  if (score >= 45) return 'warm';
  if (score >= 20) return 'cooling';
  return 'cold';
}

export function computeBorrowerHeatScore(input: BorrowerHeatInput): BorrowerHeatResult {
  const dc = input.days_since_last_contact;
  const contact = dc == null ? 0 : dc <= 7 ? 30 : dc <= 30 ? 20 : dc <= 90 ? 10 : 0;

  const dp = input.days_since_portal_login;
  const portal = dp == null ? 0 : dp <= 7 ? 25 : dp <= 30 ? 15 : dp <= 90 ? 5 : 0;

  const le = input.life_event_days_away;
  const life_event = le == null ? 0 : le <= 30 ? 20 : le <= 60 ? 10 : 0;

  const r = input.referrals_sent;
  const referrals = r >= 2 ? 15 : r === 1 ? 10 : 0;

  const dcl = input.days_since_close;
  const post_close = dcl == null ? 0 : dcl <= 365 ? 10 : dcl <= 730 ? 5 : 0;

  const score = Math.min(100, contact + portal + life_event + referrals + post_close);
  const band = bandForScore(score);

  let top_signal: string;
  if (contact >= 20) top_signal = 'Recently in contact';
  else if (life_event === 20) top_signal = 'Life event coming up within 30 days';
  else if (portal >= 15) top_signal = 'Active in the borrower portal';
  else if (referrals >= 10) top_signal = 'Has sent referrals';
  else if (post_close === 10) top_signal = 'Closed within the last year';
  else if (band === 'cooling') top_signal = 'Drifting — no touch in a while';
  else top_signal = 'Cold — overdue for outreach';

  return { score, band, components: { contact, portal, life_event, referrals, post_close }, top_signal };
}

/**
 * Recompute + snapshot heat for every borrower (lead with an assigned LO) in an org.
 * Signals: leads.last_contacted_at / closed_date, borrower_portal_tokens.last_accessed_at,
 * life_events proximity. messages_opened / referrals default to 0 (no first-class source).
 */
export async function recalcBorrowerHeatForOrg(sb: Admin, orgId: string, now: Date = new Date()): Promise<number> {
  const nowMs = now.getTime();

  const { data: leads } = await sb
    .from('leads')
    .select('id, assigned_to, last_contacted_at, closed_date, date_of_birth')
    .eq('org_id', orgId)
    .not('assigned_to', 'is', null)
    .is('archived_at', null);
  if (!leads || leads.length === 0) return 0;

  const leadIds = leads.map((l) => l.id as string);

  // Portal login recency per lead.
  const portalByLead = new Map<string, number>(); // days since last access
  {
    const { data: tokens } = await sb
      .from('borrower_portal_tokens')
      .select('lead_id, last_accessed_at')
      .eq('org_id', orgId)
      .in('lead_id', leadIds);
    for (const t of tokens ?? []) {
      if (!t.last_accessed_at) continue;
      const days = Math.floor((nowMs - new Date(t.last_accessed_at as string).getTime()) / DAY);
      const prev = portalByLead.get(t.lead_id as string);
      if (prev == null || days < prev) portalByLead.set(t.lead_id as string, days);
    }
  }

  // Life-event proximity per lead (Phase 102).
  const lifeByLead = await computeLifeEventProximity(sb, orgId, leadIds, now);

  const rows: any[] = [];
  for (const l of leads) {
    const id = l.id as string;
    const daysSinceContact = l.last_contacted_at
      ? Math.floor((nowMs - new Date(l.last_contacted_at as string).getTime()) / DAY)
      : null;
    const daysSinceClose = l.closed_date
      ? Math.floor((nowMs - new Date(l.closed_date as string).getTime()) / DAY)
      : null;
    const daysSincePortal = portalByLead.get(id) ?? null;
    const lifeDaysAway = lifeByLead.get(id) ?? null;

    const result = computeBorrowerHeatScore({
      days_since_last_contact: daysSinceContact,
      days_since_portal_login: daysSincePortal,
      days_since_close: daysSinceClose,
      life_event_days_away: lifeDaysAway,
      referrals_sent: 0,
    });

    rows.push({
      org_id: orgId,
      lead_id: id,
      lo_id: l.assigned_to,
      score: result.score,
      band: result.band,
      days_since_last_contact: daysSinceContact,
      days_since_portal_login: daysSincePortal,
      days_since_close: daysSinceClose,
      life_event_within_30d: lifeDaysAway != null && lifeDaysAway <= 30,
      referrals_sent: 0,
      driving_factors: { components: result.components, top_signal: result.top_signal },
    });
  }

  if (rows.length === 0) return 0;
  const { error } = await sb.from('borrower_heat_scores').insert(rows);
  if (error) {
    console.error('[borrowerHeat] insert failed', error.message);
    return 0;
  }
  return rows.length;
}
