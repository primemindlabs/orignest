/**
 * Phase 132 — generate a full week (7 posts) of compliant social content.
 * Claude Haiku per topic (run in parallel) with a strict compliance system prompt;
 * each post is checked with the shared post-compliance filter (Phase 96) and falls
 * back to a compliant-by-construction template on failure or when no API key is set.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { checkPostCompliance } from '@/lib/compliance/postCompliance';
import { auditPostCompliance } from './auditPostCompliance';
import { templateFor, type TemplateCtx } from './templates';
import { WEEKLY_TOPICS, type GeneratedPost, type LOProfile, type Platform } from './types';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = `You are an expert mortgage marketing copywriter for a licensed loan officer.

Your content must:
- Be platform-appropriate (LinkedIn = professional, Instagram = visual/casual, Facebook = community-focused)
- NEVER quote specific interest rates or APRs (general phrasing like "in the low-to-mid 6s" is OK)
- NEVER make income, approval, or credit guarantees
- NEVER name clients or use testimonials
- Always include the loan officer's name naturally
- Be 150-280 words for LinkedIn, 80-150 words for Instagram/Facebook
- Include 3-5 relevant hashtags (mortgage, homebuying, real estate focused)
- Be authentic and human — not corporate-speak

The LO's NMLS disclaimer is appended automatically — do not add it yourself.
Respond ONLY with minified JSON: {"post_text":"...","hashtags":"#a #b","image_prompt":"..."}.`;

function buildPostPrompt(topic: { day: string; platform: Platform; type: string }, ctx: TemplateCtx): string {
  return [
    `Write a ${topic.platform} post for ${topic.day}. Content type: ${topic.type}.`,
    `Loan officer: ${ctx.loName}. Market area: ${ctx.market}.`,
    `Current rate environment (use only this phrasing, never a number): ${ctx.rateContext}.`,
    ctx.focusTopic ? `Focus topic the LO requested: ${ctx.focusTopic}.` : '',
    topic.type === 'anonymized_win' && ctx.recentCloseType ? `Base the anonymized win on a recent ${ctx.recentCloseType} loan. Fully anonymized — no names.` : '',
    'image_prompt should describe a Canva-ready image (do not generate an image).',
  ].filter(Boolean).join('\n');
}

function parsePostResponse(text: string): { post_text: string; hashtags: string | null; image_prompt: string | null } {
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && typeof parsed.post_text === 'string') {
      return {
        post_text: parsed.post_text.trim(),
        hashtags: typeof parsed.hashtags === 'string' ? parsed.hashtags : null,
        image_prompt: typeof parsed.image_prompt === 'string' ? parsed.image_prompt : null,
      };
    }
  } catch {
    /* fall through to heuristic parse */
  }
  const tags = (text.match(/#[A-Za-z0-9_]+/g) ?? []).join(' ');
  const body = text.replace(/#[A-Za-z0-9_]+/g, '').trim();
  return { post_text: body, hashtags: tags || null, image_prompt: null };
}

async function generateOne(
  client: Anthropic | null,
  topic: { day: string; platform: Platform; type: string },
  ctx: TemplateCtx,
  nmlsFooter: string,
): Promise<GeneratedPost> {
  const fallback = (): GeneratedPost => {
    const t = templateFor(topic.type, topic.platform, ctx);
    return { platform: topic.platform, content_type: topic.type, post_day: topic.day, post_text: t.post_text, hashtags: t.hashtags, image_prompt: t.image_prompt, nmls_footer: nmlsFooter, status: 'draft' };
  };

  if (!client) return fallback();

  try {
    let resp = await client.messages.create({ model: MODEL, max_tokens: 600, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: buildPostPrompt(topic, ctx) }] });
    let block = resp.content.find((b) => b.type === 'text');
    let parsed = parsePostResponse(block && block.type === 'text' ? block.text : '');

    // Compliance gate (shared P96 filter + this phase's audit). One stricter retry.
    let compliance = checkPostCompliance(parsed.post_text);
    if (!compliance.passed || auditPostCompliance(parsed.post_text).length) {
      resp = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `${buildPostPrompt(topic, ctx)}\n\nYour previous attempt violated compliance (${compliance.flags.join('; ') || 'specific rate / guarantee / client reference'}). Rewrite with NONE of these.` }],
      });
      block = resp.content.find((b) => b.type === 'text');
      parsed = parsePostResponse(block && block.type === 'text' ? block.text : '');
      compliance = checkPostCompliance(parsed.post_text);
    }

    if (!parsed.post_text || !compliance.passed || auditPostCompliance(parsed.post_text).length) return fallback();

    return {
      platform: topic.platform,
      content_type: topic.type,
      post_day: topic.day,
      post_text: parsed.post_text,
      hashtags: parsed.hashtags ?? templateFor(topic.type, topic.platform, ctx).hashtags,
      image_prompt: parsed.image_prompt,
      nmls_footer: nmlsFooter,
      status: 'draft',
    };
  } catch (e) {
    console.error('[contentStudio] generate failed for', topic.day, e);
    return fallback();
  }
}

export async function generateWeeklyPackage(
  lo: LOProfile,
  nmlsFooter: string,
  rateContext: string,
  options?: { focusTopic?: string; marketArea?: string; recentCloseType?: string },
): Promise<GeneratedPost[]> {
  const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;
  const ctx: TemplateCtx = {
    loName: `${lo.first_name} ${lo.last_name}`.trim(),
    market: options?.marketArea || 'your local market',
    rateContext,
    focusTopic: options?.focusTopic,
    recentCloseType: options?.recentCloseType,
  };
  return Promise.all(WEEKLY_TOPICS.map((topic) => generateOne(client, topic, ctx, nmlsFooter)));
}

/** Turn the latest market rate into a compliant, number-free phrase. */
export function rateContextFromRate(rate30: number | null): string {
  if (!rate30) return 'rates have held fairly steady this week';
  const whole = Math.floor(rate30);
  const frac = rate30 - whole;
  const band = frac < 0.34 ? 'low' : frac < 0.67 ? 'mid' : 'high';
  return `rates are in the ${band}-${whole}s this week`;
}
