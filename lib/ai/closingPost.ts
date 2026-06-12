/**
 * Phase 96 — generate a compliant loan-closing celebration post.
 *
 * Uses Claude Haiku (the app's standard AI pattern) with a STRICT compliance
 * system prompt, then runs the deterministic pre-filter. If the model output
 * trips a flag, retries once; if it still fails — or if no API key is set — it
 * falls back to a hand-built template that is compliant by construction, so the
 * LO always gets a clean draft to start from.
 */
import Anthropic from '@anthropic-ai/sdk';
import { checkPostCompliance } from '@/lib/compliance/postCompliance';
import type { ClosingPostInput, ComplianceCheckResult } from '@/types/closingPosts';

const MODEL = 'claude-haiku-4-5';

const THEMES = ['Keys in hand!', 'From application to homeowner!', 'Another family finds home!', 'Closed!'];

function hashtag(loanType: string): string {
  return `#${loanType.replace(/[^A-Za-z0-9]+/g, '')}`;
}

/** Compliant-by-construction fallback (no rate/$/payment language possible). */
export function buildClosingTemplate(p: ClosingPostInput, theme: string): string {
  const main = `${theme} Congratulations to the newest homeowners in ${p.city}, ${p.state}! 🔑🏡 Honored to have guided this ${p.loan_type} journey all the way home.`;
  const sig = `— ${p.lo_name}, ${p.company_name} · NMLS# ${p.nmls_number}`;
  const tags = `#NewHomeOwner #JustClosed ${hashtag(p.loan_type)} #MortgagePro`;
  return `${main}\n\n${sig}\n${tags}`;
}

function systemPrompt(p: ClosingPostInput): string {
  return `You are a compliant mortgage marketing assistant. Generate a celebratory social media post about a loan closing.

ABSOLUTE FORBIDDEN — if any appear, the post is auto-rejected:
- Any percentage symbol (%) or numeric rate
- Any dollar sign ($) or dollar amount, or numbers like "300k"
- The words: "rate", "APR", "interest", "monthly payment", "down payment", "loan amount", "purchase price", "annual percentage"
- Any numeric financial figure

REQUIRED in the post:
- Location: ${p.city}, ${p.state}
- Loan type label only, no rate attached: ${p.loan_type}
- LO name: ${p.lo_name}
- Company: ${p.company_name}
- NMLS#: ${p.nmls_number}
- A warm celebration theme (keys, homeownership milestone, family, community)

FORMAT: main copy (under 200 characters), then a blank line, then the signature line "— ${p.lo_name}, ${p.company_name} · NMLS# ${p.nmls_number}", then a line of hashtags ending with #NewHomeOwner #JustClosed ${hashtag(p.loan_type)} #MortgagePro.

Be warm, genuine, community-focused. Never promotional or salesy. Output ONLY the post text.`;
}

async function callModel(p: ClosingPostInput, theme: string, extraGuard = ''): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const userPrompt = `Generate a loan-closing social post with theme: "${theme}"
City: ${p.city}, ${p.state}
Loan type: ${p.loan_type}
LO: ${p.lo_name} at ${p.company_name} (NMLS# ${p.nmls_number})${extraGuard}`;
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: systemPrompt(p),
    messages: [{ role: 'user', content: userPrompt }],
  });
  const block = msg.content[0];
  return block && block.type === 'text' ? block.text.trim() : '';
}

export async function generateClosingPost(
  p: ClosingPostInput,
): Promise<{ copy: string; compliance: ComplianceCheckResult; source: 'ai' | 'template' }> {
  // Vary theme by inputs (no Math.random — deterministic enough, avoids harness ban).
  const theme = THEMES[(p.city.length + p.loan_type.length) % THEMES.length];

  if (!process.env.ANTHROPIC_API_KEY) {
    const copy = buildClosingTemplate(p, theme);
    return { copy, compliance: checkPostCompliance(copy), source: 'template' };
  }

  try {
    let copy = await callModel(p, theme);
    let compliance = checkPostCompliance(copy);
    if (!compliance.passed) {
      // One stricter retry citing the exact violations.
      copy = await callModel(p, theme, `\n\nYour previous attempt was REJECTED for: ${compliance.flags.join('; ')}. Remove ALL of these.`);
      compliance = checkPostCompliance(copy);
    }
    if (!compliance.passed || !copy) {
      const tmpl = buildClosingTemplate(p, theme);
      return { copy: tmpl, compliance: checkPostCompliance(tmpl), source: 'template' };
    }
    return { copy, compliance, source: 'ai' };
  } catch (e) {
    console.error('[closing-post] AI generation failed, using template', e);
    const tmpl = buildClosingTemplate(p, theme);
    return { copy: tmpl, compliance: checkPostCompliance(tmpl), source: 'template' };
  }
}
