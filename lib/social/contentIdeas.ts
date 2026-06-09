/**
 * Phase 56.4 — AI social content idea + LinkedIn note generation (Claude Haiku).
 * SERVER-ONLY. Financial-content guard: no rate/APR claims. White-label sign-off
 * (LO name + NMLS), never "Ashley IQ" / "PrimeMind".
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export interface ContentIdea { type: string; title: string; caption: string; hashtags: string[]; image_concept: string }

const RATE_WORDS = /\b(\d+(\.\d+)?\s?%|apr|interest rate|\brate\b|points?\b|basis points|bps)\b/i;
function scrubRates<T extends { caption?: string }>(items: T[]): T[] {
  // Drop any idea whose caption slips a rate/APR claim through (financial guard).
  return items.filter((i) => !(i.caption && RATE_WORDS.test(i.caption)));
}

function text(msg: Anthropic.Message): string {
  const block = msg.content.find((b) => b.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}

export async function generateContentIdeas(ctx: { lo_name: string; nmls?: string; market_conditions: string; recent_closings: number; target_audience: string }): Promise<ContentIdea[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `Generate 6 social media content ideas for a mortgage loan officer.
LO: ${ctx.lo_name} (NMLS #${ctx.nmls ?? 'XXXXXX'})
Market: ${ctx.market_conditions}. Recent closings this month: ${ctx.recent_closings}. Audience: ${ctx.target_audience}.

For each: a content type (rate_update/buyer_tip/market_insight/testimonial_request), a title (<10 words), a full caption (2-3 short conversational paragraphs, educational not salesy), 3-5 hashtags, an image concept.
RULES: never mention specific rates or APRs; never promise approval; value-first; sign off "— ${ctx.lo_name} | NMLS #${ctx.nmls ?? 'XXXXXX'}"; minimal emojis.
Return ONLY a JSON array: [{"type","title","caption","hashtags":[],"image_concept"}]`;

  const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] });
  try {
    const raw = text(msg);
    const json = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1);
    const ideas = JSON.parse(json) as ContentIdea[];
    return scrubRates(ideas).map((i) => ({ ...i, hashtags: Array.isArray(i.hashtags) ? i.hashtags : [] }));
  } catch { return []; }
}

export async function composeLinkedInNote(p: { prospect_name: string; prospect_title?: string; prospect_company?: string; connection_context: string; lo_name: string }): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `Write a LinkedIn connection-request note (UNDER 300 characters) for a mortgage loan officer.
Prospect: ${p.prospect_name}${p.prospect_title ? `, ${p.prospect_title}` : ''}${p.prospect_company ? ` at ${p.prospect_company}` : ''}. Context: ${p.connection_context}. LO: ${p.lo_name}.
RULES: warm and genuine, not transactional; acknowledge something specific; do NOT mention rates or loans (intro only); no emojis; under 300 chars STRICTLY.
Return ONLY the note text.`;
  const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 150, messages: [{ role: 'user', content: prompt }] });
  let note = text(msg).trim().replace(/^["']|["']$/g, '');
  if (note.length > 300) note = note.slice(0, 297) + '...';
  return note;
}
