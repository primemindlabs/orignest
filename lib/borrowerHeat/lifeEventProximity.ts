// Phase 110 — nearest upcoming life-event (days away) per lead, from life_events
// (Phase 102). Recurring events use the next annual MM/DD occurrence. Returns a Map
// of lead_id -> days-away for the soonest event within 60 days (others omitted).
import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient<any, any, any>;
const DAY = 86_400_000;

function nextOccurrenceDays(eventDateISO: string, now: Date): number {
  const ev = new Date(eventDateISO + 'T00:00:00Z');
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const y = now.getUTCFullYear();
  let occ = Date.UTC(y, ev.getUTCMonth(), ev.getUTCDate());
  if (occ < todayUTC) occ = Date.UTC(y + 1, ev.getUTCMonth(), ev.getUTCDate());
  return Math.round((occ - todayUTC) / DAY);
}

export async function computeLifeEventProximity(
  sb: Admin,
  orgId: string,
  leadIds: string[],
  now: Date = new Date()
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (leadIds.length === 0) return out;

  const { data: events } = await sb
    .from('life_events')
    .select('lead_id, event_date, recurring_annually')
    .eq('org_id', orgId)
    .not('lead_id', 'is', null)
    .in('lead_id', leadIds);

  for (const e of events ?? []) {
    const leadId = e.lead_id as string | null;
    if (!leadId || !e.event_date) continue;
    const days = nextOccurrenceDays((e.event_date as string).slice(0, 10), now);
    if (days > 60) continue;
    const prev = out.get(leadId);
    if (prev == null || days < prev) out.set(leadId, days);
  }
  return out;
}
