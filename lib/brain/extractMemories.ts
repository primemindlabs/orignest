/**
 * Phase 127 — Ashley Brain™ memory extraction (server-only, Claude Haiku).
 * Turns one raw interaction log into 0–5 structured, typed memories.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { BRAIN_MEMORY_TYPES, type BrainMemoryType, type ExtractedMemory } from '@/lib/brain/types';

const MODEL = 'claude-haiku-4-5';

const PROMPT = `You are extracting relationship intelligence from a loan officer's interaction notes.

From the interaction below, extract 0 to 5 key memories that would help an executive assistant serve this relationship better in the future.

For each memory output an object with:
- "memory_type": one of [${BRAIN_MEMORY_TYPES.join(', ')}]
- "memory_text": 1-2 sentences in plain English. Specific and actionable.

Rules:
- Only extract facts clearly stated or strongly implied. Do NOT infer or guess.
- Do NOT repeat generic or obvious information.
- Do NOT restate the whole note; distill the durable facts only.
- If nothing meaningful is present, return an empty array.

Interaction type: {{log_type}}
Relationship type: {{entity_type}}
Content:
"""
{{content}}
"""

Respond with ONLY a JSON array of memory objects. No prose, no code fences.`;

const VALID_TYPES = new Set<string>(BRAIN_MEMORY_TYPES);

/** Strip code fences and pull the first JSON array out of the model's text. */
function parseMemories(text: string): ExtractedMemory[] {
  let t = text.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  }
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(t.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: ExtractedMemory[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const type = typeof r.memory_type === 'string' ? r.memory_type : '';
    const memText = typeof r.memory_text === 'string' ? r.memory_text.trim() : '';
    if (!VALID_TYPES.has(type) || !memText) continue;
    out.push({ memory_type: type as BrainMemoryType, memory_text: memText });
    if (out.length >= 5) break;
  }
  return out;
}

export async function extractMemories(log: {
  log_type: string;
  entity_type: string | null;
  content: string;
}): Promise<ExtractedMemory[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const content = (log.content ?? '').trim();
  if (content.length < 8) return []; // nothing worth a model call

  const prompt = PROMPT
    .replace('{{log_type}}', log.log_type)
    .replace('{{entity_type}}', log.entity_type ?? 'person')
    .replace('{{content}}', content.slice(0, 6000));

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : '[]';
    return parseMemories(text);
  } catch {
    return [];
  }
}
