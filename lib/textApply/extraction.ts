/**
 * Phase 68 — Text-to-Apply free-text pre-qual extraction (Claude Haiku). SERVER-ONLY.
 * Parses 3 conversational SMS replies into structured fields. Includes a PURE
 * deterministic fallback (parseValue/parseCredit) so it degrades gracefully without
 * an AI key. The richer free-text upgrade over Phase 61's numeric option flow.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export type CreditRange = 'excellent' | 'good' | 'fair' | 'needs_work';
export interface ExtractedPreQual { property_address: string | null; estimated_value: number | null; credit_range: CreditRange | null }

/** PURE: "$450k" / "450" / "four fifty" (k implied) / "around 400,000" → dollars. */
export function parseValue(raw: string): number | null {
  const t = (raw ?? '').toLowerCase().replace(/[, $]/g, '');
  const k = /(\d+(\.\d+)?)k/.exec(t);
  if (k) return Math.round(Number(k[1]) * 1000);
  const m = /(\d+(\.\d+)?)(m|mil|million)/.exec(t);
  if (m) return Math.round(Number(m[1]) * 1_000_000);
  const n = /(\d{3,})/.exec(t);
  if (n) { const v = Number(n[1]); return v < 10000 ? v * 1000 : v; } // bare "450" → 450k
  return null;
}

/** PURE: A/B/C/D, score numbers, or words → credit range enum. */
export function parseCredit(raw: string): CreditRange | null {
  const t = (raw ?? '').toLowerCase();
  if (/\b(a|excellent|great|740|7[5-9]\d|8\d\d)\b/.test(t)) return 'excellent';
  if (/\b(b|good|decent|680|69\d|7[0-3]\d)\b/.test(t)) return 'good';
  if (/\b(c|fair|okay|ok|620|6[3-7]\d)\b/.test(t)) return 'fair';
  if (/\b(d|needs?\s?work|bad|poor|below|low|5\d\d|6[01]\d)\b/.test(t)) return 'needs_work';
  return null;
}

export async function extractPreQualData(turns: { address?: string; value?: string; credit?: string }): Promise<ExtractedPreQual> {
  const fallback: ExtractedPreQual = { property_address: turns.address?.trim() || null, estimated_value: turns.value ? parseValue(turns.value) : null, credit_range: turns.credit ? parseCredit(turns.credit) : null };
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = `Extract structured data from these SMS pre-qual responses.
Address: "${turns.address ?? ''}"
Value: "${turns.value ?? ''}"
Credit: "${turns.credit ?? ''}"
Return JSON only: {"property_address": string|null, "estimated_value": integer dollars|null, "credit_range": "excellent"|"good"|"fair"|"needs_work"|null}.
credit map: A/excellent/740+→excellent; B/good/680-739→good; C/fair/620-679→fair; D/needs work/<620→needs_work.`;
    const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 256, messages: [{ role: 'user', content: prompt }] });
    const block = msg.content.find((b) => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '';
    const j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as ExtractedPreQual;
    return { property_address: j.property_address ?? fallback.property_address, estimated_value: j.estimated_value ?? fallback.estimated_value, credit_range: j.credit_range ?? fallback.credit_range };
  } catch { return fallback; }
}
