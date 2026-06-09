/**
 * Phase 30.9 — Smart Document Checklist (server-only, Claude Haiku).
 * Generates a loan-specific, prioritized doc checklist from LoanContext.
 * Cached in-process per (loanId, context hash) to avoid regenerating on every
 * page load — no new table (this extends the existing checklist feature).
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { LoanContext } from '@/lib/ui/fieldAdapter';

const MODEL = 'claude-haiku-4-5';

export interface ChecklistItem {
  item: string;
  why: string;
  priority: 'required' | 'conditional' | 'nice_to_have';
  typical_turnaround_days: number;
}

interface CacheEntry {
  hash: string;
  generatedAt: number;
  items: ChecklistItem[];
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 1000 * 60 * 60 * 6; // 6h

export function contextHash(ctx: LoanContext): string {
  return [ctx.loan_program, ctx.employment_type, ctx.property_type, ctx.transaction_type, ctx.occupancy, ctx.is_self_employed, ctx.is_military, ctx.has_co_borrower, ctx.has_reo].join('|');
}

const PRIORITIES: ChecklistItem['priority'][] = ['required', 'conditional', 'nice_to_have'];

export async function generateChecklist(loanId: string, ctx: LoanContext): Promise<{ items: ChecklistItem[]; cached: boolean }> {
  const hash = contextHash(ctx);
  const hit = cache.get(loanId);
  if (hit && hit.hash === hash && Date.now() - hit.generatedAt < TTL_MS) {
    return { items: hit.items, cached: true };
  }

  const prompt = `Generate a prioritized document checklist for this mortgage application.
Include only what's needed for this specific loan. Add a brief note explaining WHY each item is required.

${JSON.stringify(ctx, null, 2)}

Return a JSON array ordered by priority:
[{ "item": string, "why": string, "priority": "required|conditional|nice_to_have", "typical_turnaround_days": number }]
Return valid JSON only.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({ model: MODEL, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] });
  const block = res.content[0];
  let raw = block && block.type === 'text' ? block.text.trim() : '';
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const s = raw.indexOf('[');
  const e = raw.lastIndexOf(']');
  if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);

  let parsed: unknown = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  const items: ChecklistItem[] = (Array.isArray(parsed) ? parsed : [])
    .map((p) => {
      if (!p || typeof p !== 'object') return null;
      const o = p as Record<string, unknown>;
      if (typeof o.item !== 'string' || !o.item.trim()) return null;
      return {
        item: o.item.trim(),
        why: typeof o.why === 'string' ? o.why : '',
        priority: PRIORITIES.includes(o.priority as ChecklistItem['priority']) ? (o.priority as ChecklistItem['priority']) : 'conditional',
        typical_turnaround_days: Number(o.typical_turnaround_days) || 0,
      };
    })
    .filter((x): x is ChecklistItem => x !== null);

  cache.set(loanId, { hash, generatedAt: Date.now(), items });
  return { items, cached: false };
}
