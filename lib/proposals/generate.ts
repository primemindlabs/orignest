/**
 * Phase 122 — AI loan-proposal content. SERVER-ONLY. Four focused Claude Haiku calls
 * run in parallel (kept under a few seconds). Haiku ONLY — never Sonnet/Opus (cost).
 * Hard guardrails: no specific rate numbers and no rate-direction predictions in the
 * borrower-facing prose. Each section falls back to a safe template if the call fails,
 * so proposal generation never hard-errors.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { termYears } from '@/lib/proposals/payment';

export interface ProposalBorrower { firstName: string; lastName: string }
export interface ProposalLoan { propertyAddress: string | null; purchasePrice: number | null; loanType: string; borrowerGoal?: string | null }
export interface ProposalScenario { loanType: string; termYears: number }

export interface ProposalContent {
  executive_summary: string;
  recommendation_rationale: string;
  market_context: string;
  next_steps: string;
}

const SYSTEM = `You are a professional, warm mortgage loan officer writing a personalized loan proposal.
Never state, imply, or predict a specific interest rate or APR. Never predict rate direction.
Be specific and human, not promotional. No emojis. Output plain text only.`;

function prompts(b: ProposalBorrower, loan: ProposalLoan, rec: ProposalScenario, alts: ProposalScenario[], loName: string) {
  const altStr = alts.length ? alts.map((a) => `${a.loanType} ${a.termYears}-year`).join(', ') : 'the other options reviewed';
  return {
    executive_summary: `Write a 3-sentence executive summary for ${b.firstName} ${b.lastName}'s mortgage proposal.
- Property: ${loan.propertyAddress ?? 'their new home'}
- Purchase price: ${loan.purchasePrice ? `$${loan.purchasePrice.toLocaleString()}` : 'as discussed'}
- Loan type: ${loan.loanType.toUpperCase()}
- Goal: ${loan.borrowerGoal ?? 'purchase a primary residence'}
Warm, specific, professional. Under 100 words. No rate numbers. End with exactly: "I look forward to helping you achieve this goal."`,
    recommendation_rationale: `Write 2-3 sentences explaining why the ${rec.loanType} ${rec.termYears}-year is the recommended option compared to: ${altStr}.
Focus on payment stability, total cost, or qualification advantages. Specific but not promotional. Under 80 words. No rate numbers.`,
    market_context: `Write 2 sentences of general, neutral mortgage market context. Do NOT mention specific rates or predict rate direction. Focus on the value of certainty and planning. Under 60 words.`,
    next_steps: `Write a 4-item numbered next-steps list for a borrower who just received a mortgage proposal: (1) review the comparison, (2) ask questions, (3) decide on a product, (4) begin the application. Use "${loName}" as the loan officer's name. Each step under 20 words. Output as "1. ...\\n2. ..." lines.`,
  };
}

function fallback(b: ProposalBorrower, loan: ProposalLoan, rec: ProposalScenario, loName: string): ProposalContent {
  return {
    executive_summary: `${b.firstName}, thank you for the opportunity to help with financing for ${loan.propertyAddress ?? 'your new home'}. Based on our conversation about your goals, I've prepared a tailored ${loan.loanType.toUpperCase()} proposal with a clear comparison of your best options. I look forward to helping you achieve this goal.`,
    recommendation_rationale: `I'm recommending the ${rec.loanType} ${rec.termYears}-year because it best balances a predictable monthly payment with your long-term cost and qualification profile. We can adjust if your priorities change.`,
    market_context: `Mortgage markets move daily, so the real value is locking in certainty around a payment you're comfortable with. A well-structured loan lets you plan confidently regardless of where the market goes next.`,
    next_steps: `1. Review the side-by-side comparison in this proposal.\n2. Reach out to ${loName} with any questions.\n3. Decide which product fits your goals best.\n4. Begin your application so we can move toward closing.`,
  };
}

const text = (m: Anthropic.Message): string => {
  const b = m.content.find((c) => c.type === 'text');
  return b && b.type === 'text' ? b.text.trim() : '';
};

// Strip any specific rate figures a model might emit despite instructions (e.g. "6.5%").
const stripRates = (s: string) => s.replace(/\b\d{1,2}(\.\d{1,3})?\s?%/g, 'a competitive rate');

export async function generateProposalContent(
  loName: string,
  borrower: ProposalBorrower,
  loan: ProposalLoan,
  recommended: ProposalScenario,
  alternatives: ProposalScenario[],
): Promise<ProposalContent> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback(borrower, loan, recommended, loName);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const p = prompts(borrower, loan, recommended, alternatives, loName);
  const call = async (prompt: string) => {
    const msg = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 400, system: SYSTEM, messages: [{ role: 'user', content: prompt }] });
    return text(msg);
  };

  const fb = fallback(borrower, loan, recommended, loName);
  const settle = async (prompt: string, fallbackText: string) => {
    try {
      const out = await call(prompt);
      return out ? stripRates(out) : fallbackText;
    } catch {
      return fallbackText;
    }
  };

  const [executive_summary, recommendation_rationale, market_context, next_steps] = await Promise.all([
    settle(p.executive_summary, fb.executive_summary),
    settle(p.recommendation_rationale, fb.recommendation_rationale),
    settle(p.market_context, fb.market_context),
    settle(p.next_steps, fb.next_steps),
  ]);

  return { executive_summary, recommendation_rationale, market_context, next_steps };
}

export { termYears };
