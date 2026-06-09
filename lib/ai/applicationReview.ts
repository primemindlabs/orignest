/**
 * Phase 59.6 — AI pre-submission review (Claude Haiku). SERVER-ONLY.
 * Reviews a sanitized application summary (NO SSN/DOB) like a senior underwriter:
 * red flags, missing docs, LOE triggers, ready-to-submit.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export interface ApplicationReview {
  red_flags: { issue: string; severity: 'blocking' | 'warning'; section: string; recommendation: string }[];
  missing_docs: { document: string; reason: string; required_by: string }[];
  loe_triggers: { trigger: string; suggested_loe_text: string }[];
  ready_to_submit: boolean;
  summary_notes: string;
}

export async function reviewApplication(summary: Record<string, unknown>): Promise<ApplicationReview> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = `You are a senior mortgage underwriter reviewing a loan application before it goes to processing.
Identify (1) red flags likely to cause a suspension/denial, (2) missing documentation that will be required as conditions, (3) income-calculation concerns, (4) TRID/RESPA issues.
Application summary (no SSN/DOB present): ${JSON.stringify(summary).slice(0, 4000)}
Respond ONLY with JSON: {"red_flags":[{"issue","severity":"blocking"|"warning","section","recommendation"}],"missing_docs":[{"document","reason","required_by":"fannie"|"freddie"|"fha"|"va"|"lender"}],"loe_triggers":[{"trigger","suggested_loe_text"}],"ready_to_submit":boolean,"summary_notes"}`;
  const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 900, messages: [{ role: 'user', content: prompt }] });
  const block = msg.content.find((b) => b.type === 'text');
  const raw = block && block.type === 'text' ? block.text : '';
  try {
    const j = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const r = JSON.parse(j) as ApplicationReview;
    return { red_flags: r.red_flags ?? [], missing_docs: r.missing_docs ?? [], loe_triggers: r.loe_triggers ?? [], ready_to_submit: !!r.ready_to_submit, summary_notes: r.summary_notes ?? '' };
  } catch {
    return { red_flags: [], missing_docs: [], loe_triggers: [], ready_to_submit: false, summary_notes: 'Review could not be parsed.' };
  }
}
