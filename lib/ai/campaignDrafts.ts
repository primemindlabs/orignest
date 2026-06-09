/**
 * Phase 30.7 — Rate Drop Campaign draft generation (server-only, Claude Haiku).
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

export interface RateDropContext {
  firstName: string;
  originalRate: number;
  currentRate: number;
  monthlySavings: number;
  city?: string | null;
  closeDate?: string | null;
}

export interface CampaignDraftContent {
  email_subject: string;
  email_body: string;
  sms_message: string;
}

export async function generateRateDropDraft(ctx: RateDropContext): Promise<CampaignDraftContent> {
  const prompt = `Write a personalized mortgage refi outreach for a loan officer.
Be warm, specific, and non-pushy. First person from the LO.

Borrower: ${ctx.firstName}
Original rate: ${ctx.originalRate}%
Today's rate: ${ctx.currentRate}%
Monthly savings if refinanced now: $${Math.round(ctx.monthlySavings)}
${ctx.closeDate ? `Original close date: ${ctx.closeDate}` : ''}
${ctx.city ? `City: ${ctx.city}` : ''}

Return JSON only:
{ "email_subject": string, "email_body": string (<=100 words), "sms_message": string (<=60 words, conversational) }`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({ model: MODEL, max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
  const block = res.content[0];
  let raw = block && block.type === 'text' ? block.text.trim() : '';
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const s = raw.indexOf('{');
  const e = raw.lastIndexOf('}');
  if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);
  let o: Partial<CampaignDraftContent> = {};
  try {
    o = JSON.parse(raw);
  } catch {
    /* defaults below */
  }
  return {
    email_subject: o.email_subject ?? `${ctx.firstName}, rates dropped — you could save $${Math.round(ctx.monthlySavings)}/mo`,
    email_body: o.email_body ?? '',
    sms_message: o.sms_message ?? '',
  };
}
