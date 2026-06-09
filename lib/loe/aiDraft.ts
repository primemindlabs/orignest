/**
 * Phase 62.1 — LOE AI draft engine (Claude Haiku). SERVER-ONLY.
 * First-person, factual, 2-4 short paragraphs. Never includes SSN/DOB/account
 * numbers/income figures; output is sanitized post-generation.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { sanitizeLOEText } from '@/lib/loe/sanitize';

const SYSTEM = `You are a senior mortgage processor writing Letters of Explanation (LOEs) for mortgage underwriters.
Write in first person, from the borrower's perspective. Professional, factual, concise (2-4 short paragraphs).
Do not speculate — only explain facts provided. Never include SSN, DOB, account numbers, or income figures.
Always close with "I appreciate your time and consideration of my loan application." then the borrower's name.`;

type Ctx = Record<string, unknown>;
const v = (c: Ctx, k: string, d = 'to be specified by the borrower') => (c[k] != null && c[k] !== '' ? String(c[k]) : d);

const TEMPLATES: Record<string, (c: Ctx) => string> = {
  large_deposit: (c) => `Explain a large deposit of $${Number(c.amount ?? 0).toLocaleString()} on ${v(c, 'date')} into the borrower's ${v(c, 'account_type', 'account')}. Source of funds: ${v(c, 'source')}. Notes: ${v(c, 'notes', 'none')}. If a gift, note the relationship; if an asset sale, note what was sold.`,
  employment_gap: (c) => `Explain an employment gap from ${v(c, 'gap_start')} to ${v(c, 'gap_end')} (~${v(c, 'gap_months', '?')} months). Reason: ${v(c, 'reason')}. Current employment started ${v(c, 'new_employer_start')} at ${v(c, 'new_employer_name')}.`,
  change_of_employment: (c) => `Explain a change of employment. Previous: ${v(c, 'previous_employer')} (${v(c, 'previous_start')}–${v(c, 'previous_end')}). New: ${v(c, 'new_employer')} starting ${v(c, 'new_start')}. Reason: ${v(c, 'reason')}.`,
  bankruptcy: (c) => `Explain a Chapter ${v(c, 'chapter', '?')} bankruptcy discharged ${v(c, 'discharge_date')}. Circumstances: ${v(c, 'reason')}. Steps taken since: ${v(c, 'recovery_steps')}. Current stability: ${v(c, 'stability_notes')}.`,
  credit_inquiry: (c) => `Explain ${v(c, 'inquiry_count', 'recent')} credit inquiries from ${v(c, 'inquiry_creditor')} on ${v(c, 'inquiry_date')}. Reason: ${v(c, 'reason')}. New credit opened: ${c.new_account_opened ? 'Yes' : 'No'}.`,
  gift_funds: (c) => `Explain gift funds of $${Number(c.amount ?? 0).toLocaleString()} from ${v(c, 'donor_relationship', 'a family member')}. The gift is not a loan and no repayment is expected.`,
};

export async function generateLOEDraft(category: string, context: Ctx, borrowerName: string): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const body = TEMPLATES[category]?.(context) ?? `Write a letter of explanation for: ${category.replace(/_/g, ' ')}. Context: ${JSON.stringify(context).slice(0, 800)}.`;
  const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 600, system: SYSTEM, messages: [{ role: 'user', content: `Write this LOE for borrower: ${borrowerName}\n\n${body}` }] });
  const block = msg.content.find((b) => b.type === 'text');
  return sanitizeLOEText(block && block.type === 'text' ? block.text : '');
}
