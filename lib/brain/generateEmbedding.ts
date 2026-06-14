/**
 * Phase 127 — Ashley Brain™ embedding wrapper (DORMANT by default).
 *
 * Launch scope is Claude-only, so this returns null unless an embedding key is
 * present. When null, searchBrain() falls back to Postgres text search. Flip the
 * vector path on post-launch by setting OPENAI_API_KEY (no code change).
 *
 * The brain schema's embedding column is vector(1536), which matches OpenAI
 * text-embedding-3-small exactly. (If you later prefer Voyage — Anthropic's
 * recommended embeddings provider — note voyage-3 emits 1024 dims, so the
 * ashley_brain_embeddings.embedding column would need to be re-dimensioned
 * first. We use fetch() here to avoid adding an SDK dependency.)
 */
import 'server-only';

const EMBEDDING_MODEL = 'text-embedding-3-small'; // 1536 dims
const EMBEDDING_DIMS = 1536;

/** True when the vector path is provisioned. UI/search use this to decide mode. */
export function embeddingsEnabled(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export const BRAIN_EMBEDDING_DIMS = EMBEDDING_DIMS;

/**
 * Returns a 1536-dim embedding, or null when embeddings are not provisioned or
 * the call fails. Callers MUST treat null as "use the text-search fallback" —
 * never as an error.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const input = text.trim().slice(0, 8000);
  if (!input) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    const vector = json.data?.[0]?.embedding;
    return Array.isArray(vector) && vector.length === EMBEDDING_DIMS ? vector : null;
  } catch {
    return null;
  }
}
