/**
 * Phase 34.4 — campaign message personalization (server-only).
 * interpolateTemplate fills {{variables}}; personalizeMessage optionally has
 * Claude Haiku rewrite it warmer WITHOUT inventing details.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5';

export interface PersonalizationVars {
  first_name?: string | null;
  last_name?: string | null;
  lo_name?: string | null;
  company_name?: string | null;
  loan_type?: string | null;
  closed_date?: string | null; // used for anniversary math (leads.closed_date)
  [k: string]: unknown;
}

function anniversaryNumber(closedDate?: string | null): string {
  if (!closedDate) return '1';
  const years = new Date().getFullYear() - new Date(closedDate).getFullYear();
  return String(Math.max(1, years));
}

const LOAN_TYPE_LABEL: Record<string, string> = {
  conventional: 'home loan', fha: 'FHA loan', va: 'VA loan', usda: 'USDA loan', jumbo: 'jumbo loan',
  non_qm: 'home loan', heloc: 'HELOC', dscr: 'investment loan',
};

export function interpolateTemplate(template: string, lead: PersonalizationVars): string {
  const now = new Date();
  const anniv = anniversaryNumber(lead.closed_date);
  const vars: Record<string, string> = {
    first_name: String(lead.first_name ?? 'there'),
    last_name: String(lead.last_name ?? ''),
    lo_name: String(lead.lo_name ?? 'your loan officer'),
    company_name: String(lead.company_name ?? ''),
    loan_type: LOAN_TYPE_LABEL[String(lead.loan_type ?? '')] ?? 'home loan',
    current_week: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    anniversary_number: anniv,
    anniversary_plural: anniv === '1' ? '' : 's',
  };
  // Unknown {{vars}} are stripped (graceful) rather than left as literals.
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

export async function personalizeMessage(template: string, lead: PersonalizationVars, instructions?: string): Promise<string> {
  const interpolated = interpolateTemplate(template, lead);
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are a mortgage loan officer named ${lead.lo_name ?? 'the loan officer'} writing a personal message to a client.
Rewrite the following message to sound more personal and conversational. Keep the same key information and call to action.
Do NOT add any details, facts, figures, or names that are not already in the original. ${instructions ? `Style guidance: ${instructions}` : 'Keep it warm, brief, and human.'}
Max length: same as or shorter than the original. Return ONLY the rewritten message text — no explanation.

Original message:
${interpolated}`,
      }],
    });
    const block = res.content[0];
    return block && block.type === 'text' ? block.text.trim() : interpolated;
  } catch {
    return interpolated;
  }
}
