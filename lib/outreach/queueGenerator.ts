// Phase 102 — daily outreach-queue generator. For one org: find life events whose
// annual recurrence lands in the next 7 days, draft a message, and queue it for LO
// review. Idempotent (dedup: one row per life_event per calendar year per channel).
//
// Constraints honored here:
//   - NMLS required on borrower messages: if the attributed LO has no nmls_id, the
//     borrower event is SKIPPED and a warning logged (spec constraint 7).
//   - SMS items are queued with tcpa_acknowledged=false (LO must ack before send).
//   - channel: SMS when a phone exists, else email; neither → skipped.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildMessageDraft, type OutreachEventType } from './templates';

type Admin = SupabaseClient<any, any, any>;
const DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;

/** Next annual occurrence of event_date's MM/DD on or after `today` (date-only). */
export function nextOccurrence(eventDateISO: string, today: Date): Date {
  const ev = new Date(eventDateISO + 'T00:00:00Z');
  const y = today.getUTCFullYear();
  const mk = (yr: number) => new Date(Date.UTC(yr, ev.getUTCMonth(), ev.getUTCDate()));
  const thisYear = mk(y);
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  return thisYear >= todayUTC ? thisYear : mk(y + 1);
}

const toISODate = (d: Date) => d.toISOString().slice(0, 10);
const BORROWER_TYPES: OutreachEventType[] = ['birthday', 'home_anniversary', 'loan_anniversary'];

export async function generateOutreachQueueForOrg(
  sb: Admin,
  orgId: string,
  now: Date = new Date()
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  const { data: events } = await sb
    .from('life_events')
    .select('id, user_id, lead_id, realtor_id, event_type, event_date, recurring_annually')
    .eq('org_id', orgId)
    .eq('recurring_annually', true);

  if (!events || events.length === 0) return { created, skipped };

  // Resolve senders (LO name + NMLS) once for the org.
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, first_name, last_name, nmls_id, role, active')
    .eq('org_id', orgId);
  const profById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  // Representative org sender for realtor (org-owned) events.
  const orgSender =
    (profiles ?? []).find((p) => p.active && (p.role === 'loan_officer' || p.role === 'admin')) ??
    (profiles ?? [])[0] ??
    null;

  // Hydrate contacts.
  const leadIds = Array.from(new Set(events.map((e) => e.lead_id).filter(Boolean))) as string[];
  const realtorIds = Array.from(new Set(events.map((e) => e.realtor_id).filter(Boolean))) as string[];
  const leadById = new Map<string, any>();
  const realtorById = new Map<string, any>();
  if (leadIds.length) {
    const { data } = await sb
      .from('leads')
      .select('id, first_name, last_name, phone, email')
      .in('id', leadIds);
    for (const l of data ?? []) leadById.set(l.id as string, l);
  }
  if (realtorIds.length) {
    const { data } = await sb
      .from('realtors')
      .select('id, first_name, last_name, phone, email')
      .in('id', realtorIds);
    for (const r of data ?? []) realtorById.set(r.id as string, r);
  }

  // Existing queue rows this/next calendar year for dedup.
  const { data: existingQ } = await sb
    .from('outreach_queue')
    .select('life_event_id, scheduled_send_date, channel')
    .eq('org_id', orgId)
    .gte('scheduled_send_date', toISODate(new Date(now.getTime() - DAY)));
  const dedup = new Set(
    (existingQ ?? []).map(
      (q) => `${q.life_event_id}|${(q.scheduled_send_date as string).slice(0, 4)}|${q.channel}`
    )
  );

  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const windowEnd = new Date(windowStart.getTime() + WINDOW_DAYS * DAY);

  const rows: any[] = [];
  for (const ev of events) {
    const occ = nextOccurrence((ev.event_date as string).slice(0, 10), now);
    if (occ < windowStart || occ > windowEnd) continue;

    const isRealtor = ev.event_type === 'realtor_anniversary';
    const contact = isRealtor
      ? realtorById.get(ev.realtor_id as string)
      : leadById.get(ev.lead_id as string);
    if (!contact) { skipped++; continue; }

    const phone = (contact.phone as string | null) ?? null;
    const email = (contact.email as string | null) ?? null;
    const channel: 'sms' | 'email' = phone ? 'sms' : email ? 'email' : 'email';
    if (!phone && !email) { skipped++; continue; }

    // Sender + NMLS resolution.
    const sender = isRealtor ? orgSender : profById.get(ev.user_id as string) ?? orgSender;
    const loName = sender
      ? `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() || 'Your Loan Officer'
      : 'Your Loan Officer';
    const nmls = (sender?.nmls_id as string | null) ?? '';

    // NMLS gate for borrower-facing messages.
    if (BORROWER_TYPES.includes(ev.event_type as OutreachEventType) && !nmls) {
      console.warn(`[outreach] Skipped life_event ${ev.id}: LO NMLS missing`);
      skipped++;
      continue;
    }

    const firstName = isRealtor
      ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || 'there'
      : (contact.first_name as string | null) ?? 'there';

    const draft = buildMessageDraft({
      event_type: ev.event_type as OutreachEventType,
      event_date: (ev.event_date as string).slice(0, 10),
      first_name: firstName,
      lo_name: loName,
      lo_nmls: nmls,
    });

    const scheduled = toISODate(occ);
    const key = `${ev.id}|${scheduled.slice(0, 4)}|${channel}`;
    if (dedup.has(key)) { skipped++; continue; }
    dedup.add(key);

    rows.push({
      org_id: orgId,
      user_id: isRealtor ? sender?.id ?? null : (ev.user_id as string | null),
      life_event_id: ev.id,
      lead_id: ev.lead_id,
      realtor_id: ev.realtor_id,
      scheduled_send_date: scheduled,
      channel,
      message_draft: draft,
      status: 'queued',
      tcpa_acknowledged: false,
    });
  }

  // Insert one at a time so a single dedup collision (race) doesn't drop the batch.
  for (const row of rows) {
    const { error } = await sb.from('outreach_queue').insert(row);
    if (error) skipped++;
    else created++;
  }

  return { created, skipped };
}
