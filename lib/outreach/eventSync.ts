// Phase 102 — derive life_events from existing data, idempotently.
//
// Source → event:
//   leads.date_of_birth                         → birthday
//   leads.stage='closed' + leads.closing_date   → home_anniversary + loan_anniversary
//   realtors.created_at                         → realtor_anniversary (org-owned, user_id null)
//
// Idempotent by select-diff-insert (NOT ON CONFLICT — the unique guards are partial
// indexes that PostgREST can't target for upsert). Safe to run repeatedly (cron,
// stage-transition hook, manual). Returns the number of new events inserted.

import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient<any, any, any>;

interface DesiredEvent {
  org_id: string;
  user_id: string | null;
  lead_id: string | null;
  realtor_id: string | null;
  event_type: 'birthday' | 'home_anniversary' | 'loan_anniversary' | 'realtor_anniversary';
  event_date: string; // YYYY-MM-DD
}

const keyOf = (e: { lead_id: string | null; realtor_id: string | null; event_type: string }) =>
  `${e.lead_id ?? `r:${e.realtor_id}`}|${e.event_type}`;

export async function syncLifeEventsForOrg(sb: Admin, orgId: string): Promise<number> {
  const desired: DesiredEvent[] = [];

  // ── Leads → birthday + (closed) anniversaries ───────────────────────────────
  const { data: leads } = await sb
    .from('leads')
    .select('id, assigned_to, date_of_birth, stage, closing_date')
    .eq('org_id', orgId);

  for (const l of leads ?? []) {
    const leadId = l.id as string;
    const lo = (l.assigned_to as string | null) ?? null;
    if (l.date_of_birth) {
      desired.push({
        org_id: orgId,
        user_id: lo,
        lead_id: leadId,
        realtor_id: null,
        event_type: 'birthday',
        event_date: (l.date_of_birth as string).slice(0, 10),
      });
    }
    if (l.stage === 'closed' && l.closing_date) {
      const d = (l.closing_date as string).slice(0, 10);
      desired.push({ org_id: orgId, user_id: lo, lead_id: leadId, realtor_id: null, event_type: 'home_anniversary', event_date: d });
      desired.push({ org_id: orgId, user_id: lo, lead_id: leadId, realtor_id: null, event_type: 'loan_anniversary', event_date: d });
    }
  }

  // ── Realtors → partnership anniversary (org-owned) ──────────────────────────
  const { data: realtors } = await sb
    .from('realtors')
    .select('id, created_at')
    .eq('org_id', orgId)
    .eq('is_archived', false);

  for (const r of realtors ?? []) {
    if (!r.created_at) continue;
    desired.push({
      org_id: orgId,
      user_id: null,
      lead_id: null,
      realtor_id: r.id as string,
      event_type: 'realtor_anniversary',
      event_date: (r.created_at as string).slice(0, 10),
    });
  }

  if (desired.length === 0) return 0;

  // ── Diff against existing, insert only the new ones ─────────────────────────
  const { data: existing } = await sb
    .from('life_events')
    .select('lead_id, realtor_id, event_type')
    .eq('org_id', orgId);

  const have = new Set((existing ?? []).map(keyOf));
  const toInsert = desired.filter((e) => !have.has(keyOf(e)));
  if (toInsert.length === 0) return 0;

  const { error } = await sb.from('life_events').insert(toInsert);
  if (error) {
    // Unique guards may still reject a race; that's fine — they're already present.
    console.error('[syncLifeEventsForOrg]', error.message);
    return 0;
  }
  return toInsert.length;
}
