/**
 * Phase 30.1 — Condition Prediction Engine (server-only).
 *
 * Reads the loan profile + the org's learned UW outcome patterns (produced by
 * the 30.4 flywheel, public.learn_uw_patterns) and asks Claude Sonnet to predict
 * the conditions underwriting is likely to impose — before the LO submits.
 *
 * Pure function: no DB access here. The API route loads inputs + persists output.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { LoanContext } from '@/lib/ui/fieldAdapter';

const MODEL = 'claude-sonnet-4-5';

export type ConditionCategory =
  | 'income' | 'assets' | 'credit' | 'property' | 'program' | 'compliance' | 'other';

export interface PredictedCondition {
  condition_text: string;
  category: ConditionCategory;
  probability: number; // 0.0–1.0
  reasoning: string;
  source: 'historical_pattern' | 'program_guideline' | 'loan_profile';
}

export interface UWOutcomePattern {
  pattern_key: string;
  loan_count: number;
  common_conditions: Array<{
    condition_text: string;
    category?: string | null;
    frequency_pct: number;
    avg_days_to_satisfy?: number | null;
  }>;
}

/** LTV band used by both the SQL learner and the predictor — keep in sync. */
export function ltvBand(ltv: number | null | undefined): string {
  if (ltv == null) return 'unknown';
  if (ltv <= 80) return '<=80';
  if (ltv <= 90) return '80-90';
  if (ltv <= 95) return '90-95';
  return '>95';
}

/** Pattern key: loan_type|occupancy_type|ltv_band — matches learn_uw_patterns(). */
export function patternKeyFor(
  loanType: string | null | undefined,
  occupancyType: string | null | undefined,
  ltv: number | null | undefined
): string {
  return `${(loanType ?? 'unknown').toLowerCase()}|${(occupancyType ?? 'unknown').toLowerCase()}|${ltvBand(ltv)}`;
}

const CATEGORIES: ConditionCategory[] = ['income', 'assets', 'credit', 'property', 'program', 'compliance', 'other'];

/** Pull the first JSON array out of a model response (tolerates markdown fences). */
function parsePredictions(text: string): PredictedCondition[] {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) raw = raw.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((p): PredictedCondition | null => {
      if (!p || typeof p !== 'object') return null;
      const o = p as Record<string, unknown>;
      const probability = Math.max(0, Math.min(1, Number(o.probability) || 0));
      const category = CATEGORIES.includes(o.category as ConditionCategory)
        ? (o.category as ConditionCategory)
        : 'other';
      const condition_text = typeof o.condition_text === 'string' ? o.condition_text.trim() : '';
      if (!condition_text) return null;
      const source =
        o.source === 'historical_pattern' || o.source === 'program_guideline'
          ? o.source
          : 'loan_profile';
      return {
        condition_text,
        category,
        probability,
        reasoning: typeof o.reasoning === 'string' ? o.reasoning : '',
        source,
      };
    })
    .filter((x): x is PredictedCondition => x !== null)
    .filter((x) => x.probability >= 0.4)
    .sort((a, b) => b.probability - a.probability);
}

export interface PredictConditionsInput {
  context: LoanContext;
  loanAmount: number | null;
  dti: number | null;
  creditScore: number | null;
  downPaymentSource?: string | null;
  patterns: UWOutcomePattern | null;
}

export async function predictConditions(input: PredictConditionsInput): Promise<PredictedCondition[]> {
  const { context, loanAmount, dti, creditScore, downPaymentSource, patterns } = input;

  const patternSummary =
    patterns && patterns.common_conditions.length
      ? patterns.common_conditions
          .slice(0, 20)
          .map((p) => `- ${p.condition_text} (appeared in ${p.frequency_pct}% of ${patterns.loan_count} similar funded loans)`)
          .join('\n')
      : null;

  const prompt = `You are an expert mortgage underwriter with 20 years of experience.
Analyze this loan file and predict what conditions underwriting will impose.

LOAN PROFILE:
- Program: ${context.loan_program}
- Loan Amount: ${loanAmount != null ? `$${loanAmount.toLocaleString()}` : 'not specified'}
- LTV: ${context.down_payment_pct != null ? `${(100 - context.down_payment_pct).toFixed(0)}%` : 'not specified'}
- DTI: ${dti != null ? `${dti}%` : 'not specified'}
- Credit score: ${creditScore ?? 'not specified'}
- Employment: ${context.employment_type}
- Self-Employed: ${context.is_self_employed}
- Military/VA: ${context.is_military}
- Property: ${context.property_type}
- Occupancy: ${context.occupancy}
- Transaction: ${context.transaction_type}
- Has Co-Borrower: ${context.has_co_borrower}
- Other real estate owned: ${context.has_reo}
- Down Payment Source: ${downPaymentSource ?? 'not specified'}

HISTORICAL PATTERNS FOR SIMILAR LOANS IN THIS ACCOUNT:
${patternSummary ?? 'No historical data yet — base predictions on program guidelines and the loan profile only.'}

Return a JSON array of predicted conditions. Each object:
{
  "condition_text": "exact condition as UW would write it",
  "category": "income|assets|credit|property|program|compliance|other",
  "probability": 0.0-1.0,
  "reasoning": "one sentence why this is likely",
  "source": "historical_pattern|program_guideline|loan_profile"
}

Order by probability descending. Include only conditions with probability >= 0.4.
Use "historical_pattern" as the source when a prediction is driven by the account's
historical patterns above. Return valid JSON only — no markdown, no prose outside the array.`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = response.content[0];
  if (!block || block.type !== 'text') return [];
  return parsePredictions(block.text);
}
