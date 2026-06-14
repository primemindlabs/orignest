/**
 * Phase 127 — Ashley Brain™ supersede model.
 * Memories are never edited or deleted. A correction inserts a NEW memory and
 * marks the old one inactive (is_active=false, superseded_by=new.id). Both are
 * retained forever. Only the bookkeeping columns on the old row ever change.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertMemory } from '@/lib/brain/addMemory';
import type { BrainEntityType, BrainMemory, BrainMemoryType } from '@/lib/brain/types';

export async function supersedeMemory(
  supabase: SupabaseClient,
  params: { oldMemoryId: string; newMemoryText: string; loId: string; orgId: string },
): Promise<BrainMemory> {
  // Old memory must belong to this LO — scope the read by lo_id.
  const { data: old, error: readErr } = await supabase
    .from('ashley_brain_memories')
    .select('id, entity_type, entity_id, memory_type')
    .eq('id', params.oldMemoryId)
    .eq('lo_id', params.loId)
    .single();
  if (readErr) throw readErr;

  const newMemory = await insertMemory(supabase, {
    loId: params.loId,
    orgId: params.orgId,
    entityType: old.entity_type as BrainEntityType,
    entityId: old.entity_id as string,
    memoryType: old.memory_type as BrainMemoryType,
    memoryText: params.newMemoryText,
    source: 'lo_input',
    confidence: 1.0,
  });

  const { error: updErr } = await supabase
    .from('ashley_brain_memories')
    .update({ is_active: false, superseded_by: newMemory.id })
    .eq('id', params.oldMemoryId)
    .eq('lo_id', params.loId);
  if (updErr) throw updErr;

  return newMemory;
}
