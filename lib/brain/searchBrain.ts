/**
 * Phase 127 — Ashley Brain™ semantic recall.
 *
 * Two modes, chosen automatically:
 *  - VECTOR (when OPENAI_API_KEY is set): embed the query, call the search_brain
 *    pgvector RPC for true semantic similarity.
 *  - TEXT FALLBACK (launch default): keyword ILIKE over memories + logs. Coarser,
 *    but live today with no extra vendor. Flipping on the key upgrades this
 *    silently — no code or call-site change.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding } from '@/lib/brain/generateEmbedding';
import type { BrainSearchResult } from '@/lib/brain/types';

interface SearchOptions {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

/** Keep only safe, meaningful tokens for an ILIKE OR-filter. */
function tokenize(query: string): string[] {
  const cleaned = query.replace(/[%,()]/g, ' ');
  const terms = cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  return Array.from(new Set(terms)).slice(0, 6);
}

async function textSearch(
  supabase: SupabaseClient,
  loId: string,
  query: string,
  options: SearchOptions,
): Promise<BrainSearchResult[]> {
  const terms = tokenize(query);
  const limit = options.limit ?? 10;

  const buildOr = (col: string) =>
    (terms.length ? terms : [query.replace(/[%,()]/g, ' ').trim()])
      .filter(Boolean)
      .map((t) => `${col}.ilike.%${t}%`)
      .join(',');

  // Memories first (distilled facts), then raw logs.
  let memQ = supabase
    .from('ashley_brain_memories')
    .select('id, memory_text, entity_type, entity_id')
    .eq('lo_id', loId)
    .eq('is_active', true)
    .order('extracted_at', { ascending: false })
    .limit(limit);
  if (options.entityType) memQ = memQ.eq('entity_type', options.entityType);
  if (options.entityId) memQ = memQ.eq('entity_id', options.entityId);
  const memOr = buildOr('memory_text');
  if (memOr) memQ = memQ.or(memOr);

  let logQ = supabase
    .from('ashley_brain_logs')
    .select('id, content, entity_type, entity_id')
    .eq('lo_id', loId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (options.entityType) logQ = logQ.eq('entity_type', options.entityType);
  if (options.entityId) logQ = logQ.eq('entity_id', options.entityId);
  const logOr = buildOr('content');
  if (logOr) logQ = logQ.or(logOr);

  const [{ data: mems }, { data: logs }] = await Promise.all([memQ, logQ]);

  const results: BrainSearchResult[] = [];
  for (const m of mems ?? []) {
    results.push({
      content_id: m.id as string,
      content_type: 'memory',
      entity_type: (m.entity_type as string) ?? null,
      entity_id: (m.entity_id as string) ?? null,
      content_text: m.memory_text as string,
      similarity: 0.6, // coarse: keyword hit on a distilled memory
    });
  }
  for (const l of logs ?? []) {
    results.push({
      content_id: l.id as string,
      content_type: 'log',
      entity_type: (l.entity_type as string) ?? null,
      entity_id: (l.entity_id as string) ?? null,
      content_text: l.content as string,
      similarity: 0.4, // coarse: keyword hit on a raw log
    });
  }
  return results.slice(0, limit);
}

export async function searchBrain(
  supabase: SupabaseClient,
  loId: string,
  query: string,
  options: SearchOptions = {},
): Promise<BrainSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // Vector path — only when provisioned.
  const embedding = await generateEmbedding(q);
  if (embedding) {
    const { data, error } = await supabase.rpc('search_brain', {
      p_lo_id: loId,
      p_query_embedding: embedding,
      p_entity_type: options.entityType ?? null,
      p_entity_id: options.entityId ?? null,
      p_limit: options.limit ?? 10,
      p_match_threshold: 0.75,
    });
    if (!error) return (data ?? []) as BrainSearchResult[];
    // If the RPC/extension isn't there yet, fall through to text search.
  }

  return textSearch(supabase, loId, q, options);
}
