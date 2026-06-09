/**
 * Phase 30.2 — Competitor LE Analyzer (server-only).
 *
 * - extractCompetitorFeesFromText(): pulls a fee structure out of Textract'd LE
 *   text (used by the gated PDF path).
 * - generateComparison(): the always-available value — Claude turns our figures
 *   vs. the competitor's into LO phone talking points + a 5-year net difference.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-5';

export interface CompetitorFees {
  lender_name?: string | null;
  interest_rate?: number | null;
  apr?: number | null;
  points?: number | null;
  origination_fee?: number | null;
  underwriting_fee?: number | null;
  appraisal_fee?: number | null;
  title_fees?: number | null;
  total_closing_costs?: number | null;
  monthly_payment?: number | null;
  loan_amount?: number | null;
}

export interface OurLeSnapshot {
  interest_rate?: number | null;
  apr?: number | null;
  points?: number | null;
  total_closing_costs?: number | null;
  monthly_payment?: number | null;
  loan_amount?: number | null;
  lock_days?: number | null;
}

export interface ComparisonAnalysis {
  talking_points: string[];
  summary: string;
  net_difference_5yr: number;
  we_win_on: string[];
}

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function firstJson<T>(text: string, fallback: T): T {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const s = raw.indexOf('{');
  const e = raw.lastIndexOf('}');
  if (s !== -1 && e !== -1) raw = raw.slice(s, e + 1);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function extractCompetitorFeesFromText(rawText: string): Promise<CompetitorFees> {
  const prompt = `Extract the fee structure from this Loan Estimate. Return JSON only:
{
  "lender_name": string,
  "interest_rate": number,
  "apr": number,
  "points": number,
  "origination_fee": number,
  "underwriting_fee": number,
  "appraisal_fee": number,
  "title_fees": number,
  "total_closing_costs": number,
  "monthly_payment": number,
  "loan_amount": number
}
Use null for anything not present. Raw text:
${rawText.substring(0, 6000)}`;

  const res = await client().messages.create({ model: MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
  const block = res.content[0];
  return firstJson<CompetitorFees>(block && block.type === 'text' ? block.text : '', {});
}

export async function generateComparison(input: {
  ourLe: OurLeSnapshot;
  competitor: CompetitorFees;
  competitorName: string;
}): Promise<ComparisonAnalysis> {
  const prompt = `You are a mortgage loan officer coach.
Compare these two Loan Estimates and write talking points the LO can use on a phone call.

OUR LE:
${JSON.stringify(input.ourLe, null, 2)}

COMPETITOR LE (${input.competitorName || 'competitor'}):
${JSON.stringify(input.competitor, null, 2)}

Write 3-5 talking points. Be specific with dollar amounts and timeframes.
Calculate the net cost difference over 5 years (rate savings vs. fee premium, or vice versa) as a single number from OUR borrower's perspective (positive = borrower saves with us).
Tone: confident, factual, never disparaging of the competitor. If a field is missing, reason from what is present and don't invent figures.
Return JSON only:
{ "talking_points": string[], "summary": string, "net_difference_5yr": number, "we_win_on": string[] }`;

  const res = await client().messages.create({ model: MODEL, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] });
  const block = res.content[0];
  const parsed = firstJson<Partial<ComparisonAnalysis>>(block && block.type === 'text' ? block.text : '', {});
  return {
    talking_points: Array.isArray(parsed.talking_points) ? parsed.talking_points.map(String) : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    net_difference_5yr: Number(parsed.net_difference_5yr) || 0,
    we_win_on: Array.isArray(parsed.we_win_on) ? parsed.we_win_on.map(String) : [],
  };
}
