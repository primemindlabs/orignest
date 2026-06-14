/**
 * Phase 127 — Ashley Brain™ memory writes.
 * insertMemory() is shared by the manual "Add memory" UI and the extraction
 * pipeline. Embeddings are best-effort: if the vector path is dormant
 * (no key), the memory is still stored and remains fully usable via text search.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/brain/generateEmbedding';
import type { BrainEntityType, BrainMemory, BrainMemorySource, BrainMemoryType } from '@/lib/brain/types';

/** Generate + persist an embedding row. No-op (silent) when embeddings are off. */
export async function storeEmbedding(
  supabase: SupabaseClient,
  params: {
    loId: string;
    orgId: string;
    contentType: 'memory' | 'call_note' | 'meeting_note' | 'sms_thread' | 'portal_chat' | 'lo_note';
    contentId: string;
    entityType: string | null;
    entityId: string | null;
    contentText: string;
  },
): Promise<void> {
  const embedding = await generateEmbedding(params.contentText);
  if (!embedding) return;
  await supabase
    .from('ashley_brain_embeddings')
    .insert({
      lo_id: params.loId,
      org_id: params.orgId,
      content_type: params.contentType,
      content_id: params.contentId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      content_text: params.contentText,
      embedding,
    })
    .then(() => undefined, () => undefined);
}

export async function insertMemory(
  supabase: SupabaseClient,
  params: {
    loId: string;
    orgId: string;
    entityType: BrainEntityType;
    entityId: string;
    memoryType: BrainMemoryType;
    memoryText: string;
    source: BrainMemorySource;
    sourceId?: string | null;
    confidence?: number;
  },
): Promise<BrainMemory> {
  const { data, error } = await supabase
    .from('ashley_brain_memories')
    .insert({
      org_id: params.orgId,
      lo_id: params.loId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      memory_type: params.memoryType,
      memory_text: params.memoryText,
      source: params.source,
      source_id: params.sourceId ?? null,
      confidence: params.confidence ?? 1.0,
    })
    .select('id, memory_type, memory_text, source, extracted_at, is_active')
    .single();

  if (error) throw error;
  const memory = data as BrainMemory;

  await storeEmbedding(supabase, {
    loId: params.loId,
    orgId: params.orgId,
    contentType: 'memory',
    contentId: memory.id,
    entityType: params.entityType,
    entityId: params.entityId,
    contentText: params.memoryText,
  });

  return memory;
}

/** Convenience for the manual "Add memory" UI (source = lo_input). */
export async function addManualMemory(
  supabase: SupabaseClient,
  params: {
    loId: string;
    orgId: string;
    entityType: BrainEntityType;
    entityId: string;
    memoryType: BrainMemoryType;
    memoryText: string;
  },
): Promise<BrainMemory> {
  return insertMemory(supabase, { ...params, source: 'lo_input', confidence: 1.0 });
}
