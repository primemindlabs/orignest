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

// ── Phase 100 — realtor weekly EMAIL update (summary + talking points) ────────
export interface RealtorEmailUpdateInput {
  rate_30yr_conv: number;
  rate_15yr_conv: number;
  rate_30yr_fha: number;
  rate_30yr_va: number;
  week_of: string; // e.g. 'June 9, 2026'
  lo_name: string;
  service_areas: string;
}
export interface RealtorEmailUpdateContent {
  market_summary: string;
  talking_points: string[];
}

/** Compliant-by-construction fallback when no API key is configured. */
function realtorEmailTemplate(p: RealtorEmailUpdateInput): RealtorEmailUpdateContent {
  return {
    market_summary:
      `Here's where mortgage rates stand for the week of ${p.week_of}. 30-year conventional is at ${p.rate_30yr_conv.toFixed(3)}% and 15-year at ${p.rate_15yr_conv.toFixed(3)}%, with FHA at ${p.rate_30yr_fha.toFixed(3)}% and VA at ${p.rate_30yr_va.toFixed(3)}%.\n\n` +
      `Buyers in ${p.service_areas} have real options across loan types right now. I'm happy to run numbers for any of your clients so they can shop with confidence.`,
    talking_points: [
      'FHA and VA remain strong paths for qualified buyers',
      'Pre-approval gives buyers a competitive edge on offers',
      'Rate-and-term and buydown options can fit different budgets',
      `Reach out anytime for a same-day pre-approval in ${p.service_areas}`,
    ],
  };
}

export async function generateRealtorEmailUpdate(p: RealtorEmailUpdateInput): Promise<RealtorEmailUpdateContent> {
  if (!process.env.ANTHROPIC_API_KEY) return realtorEmailTemplate(p);

  const system = `You are a mortgage market update writer for ${p.lo_name}, a licensed Loan Officer.
Write clear, helpful weekly market summaries realtors can share with buyers. Professional but approachable — no jargon, no corporate tone.
NEVER predict rates will go up or down — only describe what rates ARE right now. No promises about future rates.
Maximum 2 paragraphs for the summary. Each talking point under 20 words.`;
  const user = `Write a market update for the week of ${p.week_of}.
Current rates:
- 30-Year Conventional: ${p.rate_30yr_conv.toFixed(3)}%
- 15-Year Conventional: ${p.rate_15yr_conv.toFixed(3)}%
- 30-Year FHA: ${p.rate_30yr_fha.toFixed(3)}%
- 30-Year VA: ${p.rate_30yr_va.toFixed(3)}%
Service area: ${p.service_areas}

Return JSON only: { "summary": "2-paragraph market summary", "talking_points": ["point 1","point 2","point 3","point 4"] }`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({ model: MODEL, max_tokens: 600, system, messages: [{ role: 'user', content: user }] });
    const block = res.content[0];
    let raw = block && block.type === 'text' ? block.text.trim() : '';
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) raw = fence[1].trim();
    const s = raw.indexOf('{'); const e = raw.lastIndexOf('}');
    if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);
    const o = JSON.parse(raw) as { summary?: string; talking_points?: string[] };
    const summary = (o.summary ?? '').trim();
    const points = Array.isArray(o.talking_points) ? o.talking_points.filter(Boolean) : [];
    if (!summary || points.length === 0) return realtorEmailTemplate(p);
    return { market_summary: summary, talking_points: points };
  } catch (err) {
    console.error('[market-update] AI generation failed, using template', err);
    return realtorEmailTemplate(p);
  }
}
