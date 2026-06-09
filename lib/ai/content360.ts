/**
 * Phase 58.3 — Content 360 next-best-content recommendations (Claude Haiku).
 * SERVER-ONLY. Suggests 3 content pieces from the allowed catalog given the
 * contact's recent engagement. No rates/APRs in copy (downstream content guards).
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export interface ContentRec { type: string; title: string; reason: string; priority: 1 | 2 | 3 }

export async function generateContentRecommendations(ctx: { contact_type: string; loan_stage?: string; days_since_last_contact: number | null; tier: string; recent_count: number; recent_types: string[]; last_content_title?: string }): Promise<ContentRec[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `You are an expert mortgage marketing advisor. Recommend the 3 most effective next content pieces to send this contact.
Contact: ${ctx.contact_type}. Loan stage: ${ctx.loan_stage ?? 'prospect'}. Days since last contact: ${ctx.days_since_last_contact ?? 'unknown'}. Engagement tier: ${ctx.tier}. Engagements last 30d: ${ctx.recent_count}. Recent types: ${ctx.recent_types.join(', ') || 'none'}. Last engaged: ${ctx.last_content_title ?? 'n/a'}.
Available types: rate_drop_alert | market_update | video_message | scenario_pdf | co_marketing_flyer | email_campaign.
Return ONLY a JSON array: [{"type","title","reason":"1 sentence","priority":1|2|3}]`;
  const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
  const block = msg.content.find((b) => b.type === 'text');
  const raw = block && block.type === 'text' ? block.text : '';
  try { const j = raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1); return JSON.parse(j) as ContentRec[]; } catch { return []; }
}
