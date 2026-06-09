/**
 * Phase 30.8 — Market Update content generation (server-only, Claude Haiku).
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

export interface MarketUpdateInput {
  rate30yr: number;
  rate15yr: number;
  rateChangeBps: number;
  loName: string;
  loCity?: string | null;
  marketContext?: string | null;
}

export interface MarketUpdateContent {
  linkedin_post: string;
  instagram_caption: string;
  sms_blast: string;
}

export async function generateMarketUpdate(input: MarketUpdateInput): Promise<MarketUpdateContent> {
  const prompt = `Write mortgage market update content for a loan officer's social media.
Professional but approachable. Always end with a soft CTA.

30-year fixed: ${input.rate30yr}%
15-year fixed: ${input.rate15yr}%
Change from last week: ${input.rateChangeBps > 0 ? '+' : ''}${input.rateChangeBps} basis points
LO name: ${input.loName}${input.loCity ? `, City: ${input.loCity}` : ''}
Additional context: ${input.marketContext || 'none'}

Return JSON only:
{ "linkedin_post": string (2-3 paragraphs, professional, <=200 words),
  "instagram_caption": string (punchy, 2-3 sentences + 5 relevant hashtags),
  "sms_blast": string (<=60 words, casual, ends with a reply prompt) }`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({ model: MODEL, max_tokens: 900, messages: [{ role: 'user', content: prompt }] });
  const block = res.content[0];
  let raw = block && block.type === 'text' ? block.text.trim() : '';
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const s = raw.indexOf('{');
  const e = raw.lastIndexOf('}');
  if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);
  let o: Partial<MarketUpdateContent> = {};
  try {
    o = JSON.parse(raw);
  } catch {
    /* defaults */
  }
  return {
    linkedin_post: o.linkedin_post ?? '',
    instagram_caption: o.instagram_caption ?? '',
    sms_blast: o.sms_blast ?? '',
  };
}
