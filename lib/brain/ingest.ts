/**
 * Phase 127 — Ashley Brain™ passive ingestion.
 * Mirrors recent activity from existing tables (communications, realtor_touches,
 * lead_notes) into ashley_brain_logs WITHOUT touching any sender code — read-only
 * of those tables. Dedupe is by raw_metadata.source_ref ('<table>:<uuid>'), with
 * an app-level guard so it's safe whether or not the unique index is live.
 * Inserted logs are left unprocessed; the cron's extraction phase distills them.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrainLogType } from '@/lib/brain/types';

interface NewLog {
  org_id: string;
  lo_id: string;
  entity_type: 'borrower' | 'realtor';
  entity_id: string;
  log_type: BrainLogType;
  content: string;
  raw_metadata: Record<string, unknown>;
}

const INGEST_WINDOW_DAYS = 3;
const DEDUPE_WINDOW_DAYS = 14;
const PER_SOURCE_LIMIT = 200;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function commChannelToLogType(channel: string, direction: string): BrainLogType {
  switch (channel) {
    case 'call':
      return 'call_note';
    case 'sms':
      return direction === 'inbound' ? 'sms_received' : 'sms_sent';
    case 'email':
      return direction === 'inbound' ? 'email_received' : 'email_sent';
    default:
      return 'lo_note';
  }
}

function touchTypeToLogType(touchType: string): BrainLogType {
  switch (touchType) {
    case 'call':
      return 'call_note';
    case 'email':
      return 'email_sent';
    case 'sms':
      return 'sms_sent';
    case 'in_person':
      return 'meeting_note';
    default:
      return 'lo_note';
  }
}

/** Pull the set of source_refs already ingested recently for this org. */
async function existingRefs(sb: SupabaseClient, orgId: string): Promise<Set<string>> {
  const { data } = await sb
    .from('ashley_brain_logs')
    .select('raw_metadata')
    .eq('org_id', orgId)
    .gte('created_at', isoDaysAgo(DEDUPE_WINDOW_DAYS))
    .limit(5000);
  const set = new Set<string>();
  for (const row of data ?? []) {
    const ref = (row.raw_metadata as Record<string, unknown> | null)?.source_ref;
    if (typeof ref === 'string') set.add(ref);
  }
  return set;
}

export async function ingestOrg(sb: SupabaseClient, orgId: string): Promise<number> {
  const seen = await existingRefs(sb, orgId);
  const since = isoDaysAgo(INGEST_WINDOW_DAYS);
  const rows: NewLog[] = [];

  const push = (table: string, id: string, log: Omit<NewLog, 'raw_metadata'>) => {
    const ref = `${table}:${id}`;
    if (seen.has(ref)) return;
    seen.add(ref);
    rows.push({ ...log, raw_metadata: { source_ref: ref, source_table: table } });
  };

  // 1) communications (LO = leads.assigned_to)
  try {
    const { data } = await sb
      .from('communications')
      .select('id, lead_id, channel, direction, subject, body, created_at, leads(assigned_to)')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT);
    for (const c of data ?? []) {
      const leadRel = c.leads as { assigned_to?: string } | { assigned_to?: string }[] | null;
      const assignedTo = Array.isArray(leadRel) ? leadRel[0]?.assigned_to : leadRel?.assigned_to;
      const body = (c.body as string) ?? '';
      if (!assignedTo || !c.lead_id || !body.trim()) continue;
      const subject = (c.subject as string) ?? '';
      push('communications', c.id as string, {
        org_id: orgId,
        lo_id: assignedTo,
        entity_type: 'borrower',
        entity_id: c.lead_id as string,
        log_type: commChannelToLogType(c.channel as string, c.direction as string),
        content: subject ? `${subject}\n${body}` : body,
      });
    }
  } catch {
    /* skip source on error */
  }

  // 2) realtor_touches (LO = lo_id)
  try {
    const { data } = await sb
      .from('realtor_touches')
      .select('id, realtor_id, lo_id, touch_type, subject, body, outcome, created_at')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT);
    for (const t of data ?? []) {
      const content = [t.subject, t.body, t.outcome].filter((s) => typeof s === 'string' && s.trim()).join(' — ');
      if (!t.lo_id || !t.realtor_id || !content.trim()) continue;
      push('realtor_touches', t.id as string, {
        org_id: orgId,
        lo_id: t.lo_id as string,
        entity_type: 'realtor',
        entity_id: t.realtor_id as string,
        log_type: touchTypeToLogType(t.touch_type as string),
        content,
      });
    }
  } catch {
    /* skip source on error */
  }

  // 3) lead_notes (LO = author_id)
  try {
    const { data } = await sb
      .from('lead_notes')
      .select('id, lead_id, author_id, content, created_at')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(PER_SOURCE_LIMIT);
    for (const n of data ?? []) {
      const content = (n.content as string) ?? '';
      if (!n.author_id || !n.lead_id || !content.trim()) continue;
      push('lead_notes', n.id as string, {
        org_id: orgId,
        lo_id: n.author_id as string,
        entity_type: 'borrower',
        entity_id: n.lead_id as string,
        log_type: 'lo_note',
        content,
      });
    }
  } catch {
    /* skip source on error */
  }

  if (!rows.length) return 0;
  // Insert one-by-one so a single dupe (unique-index hit) can't drop the batch.
  let inserted = 0;
  for (const row of rows) {
    const { error } = await sb.from('ashley_brain_logs').insert(row);
    if (!error) inserted += 1;
  }
  return inserted;
}
