/**
 * Phase 127 — Ashley Brain™ log + processing pipeline.
 * logInteraction() appends an immutable log, then processLog() distills it into
 * memories (Claude Haiku) and marks it processed. Both are used by the /api/brain
 * routes and the nightly ingestion/extraction cron. All steps are best-effort:
 * a failed extraction never blocks the log write.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractMemories } from '@/lib/brain/extractMemories';
import { insertMemory, storeEmbedding } from '@/lib/brain/addMemory';
import type {
  BrainEntityType,
  BrainLog,
  BrainLogType,
  BrainMemorySource,
} from '@/lib/brain/types';

// log_type → the source label stored on memories extracted from it.
const SOURCE_BY_LOG: Record<BrainLogType, BrainMemorySource> = {
  call_note: 'call_note',
  meeting_note: 'meeting_note',
  portal_chat: 'portal_chat',
  sms_sent: 'sms',
  sms_received: 'sms',
  email_sent: 'email',
  email_received: 'email',
  lo_note: 'lo_input',
  autopilot_outcome: 'autopilot_outcome',
};

// log_type → embedding content_type (constrained by the embeddings CHECK).
type EmbContentType = 'call_note' | 'meeting_note' | 'sms_thread' | 'portal_chat' | 'lo_note';
const EMB_TYPE_BY_LOG: Record<BrainLogType, EmbContentType> = {
  call_note: 'call_note',
  meeting_note: 'meeting_note',
  portal_chat: 'portal_chat',
  sms_sent: 'sms_thread',
  sms_received: 'sms_thread',
  email_sent: 'lo_note',
  email_received: 'lo_note',
  lo_note: 'lo_note',
  autopilot_outcome: 'lo_note',
};

/** Distill a log into memories + embeddings, then mark it processed. */
export async function processLog(supabase: SupabaseClient, log: BrainLog): Promise<string[]> {
  const memoryIds: string[] = [];

  // Memories require an entity to attach to; skip extraction for entity-less logs.
  if (log.entity_type && log.entity_id) {
    const extracted = await extractMemories({
      log_type: log.log_type,
      entity_type: log.entity_type,
      content: log.content,
    });
    for (const m of extracted) {
      try {
        const created = await insertMemory(supabase, {
          loId: log.lo_id,
          orgId: log.org_id,
          entityType: log.entity_type,
          entityId: log.entity_id,
          memoryType: m.memory_type,
          memoryText: m.memory_text,
          source: SOURCE_BY_LOG[log.log_type],
          sourceId: log.id,
        });
        memoryIds.push(created.id);
      } catch {
        /* best-effort: one bad memory shouldn't drop the rest */
      }
    }
  }

  // Embed the raw log content too (semantic recall over verbatim text).
  await storeEmbedding(supabase, {
    loId: log.lo_id,
    orgId: log.org_id,
    contentType: EMB_TYPE_BY_LOG[log.log_type],
    contentId: log.id,
    entityType: log.entity_type,
    entityId: log.entity_id,
    contentText: log.content,
  });

  // Mark processed (column-level grant permits these three columns only).
  await supabase
    .from('ashley_brain_logs')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      extracted_memory_ids: memoryIds,
    })
    .eq('id', log.id)
    .then(() => undefined, () => undefined);

  return memoryIds;
}

/** Append a log and (optionally) extract from it immediately. */
export async function logInteraction(
  supabase: SupabaseClient,
  params: {
    loId: string;
    orgId: string;
    entityType: BrainEntityType | null;
    entityId: string | null;
    logType: BrainLogType;
    content: string;
    rawMetadata?: Record<string, unknown>;
    extractNow?: boolean;
  },
): Promise<{ logId: string; memoryIds: string[] }> {
  const { data, error } = await supabase
    .from('ashley_brain_logs')
    .insert({
      org_id: params.orgId,
      lo_id: params.loId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      log_type: params.logType,
      content: params.content,
      raw_metadata: params.rawMetadata ?? {},
    })
    .select('id, org_id, lo_id, entity_type, entity_id, log_type, content, raw_metadata')
    .single();
  if (error) throw error;

  const log = data as BrainLog;
  let memoryIds: string[] = [];
  if (params.extractNow !== false) {
    memoryIds = await processLog(supabase, log);
  }
  return { logId: log.id, memoryIds };
}
