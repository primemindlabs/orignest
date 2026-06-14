/**
 * Phase 127 — Ashley Brain™ structured memory fetch.
 * Used by the profile panel, call-prep, and morning brief. Always scoped to the
 * LO's own memories (lo_id = profiles.id) — the admin client bypasses RLS, so
 * this app-layer scope is what enforces isolation.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BrainEntityType, BrainMemory } from '@/lib/brain/types';

export async function getEntityMemories(
  supabase: SupabaseClient,
  loId: string,
  entityType: BrainEntityType,
  entityId: string,
  options?: { types?: string[]; limit?: number; activeOnly?: boolean },
): Promise<BrainMemory[]> {
  let query = supabase
    .from('ashley_brain_memories')
    .select('id, memory_type, memory_text, source, extracted_at, is_active')
    .eq('lo_id', loId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('extracted_at', { ascending: false });

  if (options?.activeOnly !== false) query = query.eq('is_active', true);
  if (options?.types?.length) query = query.in('memory_type', options.types);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BrainMemory[];
}

/** The most recent raw logs for an entity — the "recent activity" rail in call-prep. */
export async function getRecentLogs(
  supabase: SupabaseClient,
  loId: string,
  entityType: BrainEntityType,
  entityId: string,
  options?: { limit?: number },
): Promise<{ id: string; log_type: string; content: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from('ashley_brain_logs')
    .select('id, log_type, content, created_at')
    .eq('lo_id', loId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 3);
  if (error) throw error;
  return data ?? [];
}
