/**
 * Phase 30.6 — Pipeline Velocity Predictor (server-only).
 *
 * Predicts a close date + risk level for an active loan using Claude Haiku
 * (cheap enough to run daily across every active loan). Reads the loan's stage
 * timing, open conditions, behavior score, and the org's learned UW benchmark.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';

export type RiskLevel = 'on_track' | 'watch' | 'at_risk' | 'critical';

export interface VelocityPrediction {
  predicted_close_date: string; // YYYY-MM-DD
  confidence_interval_days: number;
  days_behind_typical: number;
  risk_level: RiskLevel;
  risk_factors: Array<{ factor: string; impact_days: number; description: string }>;
  recommendation: string;
}

export interface VelocityInput {
  stage: string;
  daysInCurrentStage: number;
  targetCloseDate: string | null;
  openConditions: Array<{ category: string | null; condition_text: string }>;
  loanProgram: string;
  employmentType: string;
  behaviorScore: number | null;
  avgDaysTotalUw: number | null; // learned benchmark
  todayISO: string; // caller-supplied (Date.now is unavailable in some runtimes)
}

const RISK_LEVELS: RiskLevel[] = ['on_track', 'watch', 'at_risk', 'critical'];

function parsePrediction(text: string, todayISO: string): VelocityPrediction {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);

  let o: Record<string, unknown> = {};
  try {
    o = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    /* fall through to defaults */
  }

  const risk_level = RISK_LEVELS.includes(o.risk_level as RiskLevel) ? (o.risk_level as RiskLevel) : 'watch';
  const ci = Number(o.confidence_interval_days);
  const dbt = Number(o.days_behind_typical);

  // Fallback close date: 21 days out if the model returned nothing usable.
  let close = typeof o.predicted_close_date === 'string' ? o.predicted_close_date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(close)) {
    const d = new Date(todayISO);
    d.setDate(d.getDate() + 21);
    close = d.toISOString().slice(0, 10);
  }

  const factors = Array.isArray(o.risk_factors)
    ? (o.risk_factors as unknown[])
        .map((f) => {
          if (!f || typeof f !== 'object') return null;
          const r = f as Record<string, unknown>;
          return {
            factor: String(r.factor ?? ''),
            impact_days: Number(r.impact_days) || 0,
            description: String(r.description ?? ''),
          };
        })
        .filter((x): x is { factor: string; impact_days: number; description: string } => !!x && !!x.factor)
    : [];

  return {
    predicted_close_date: close,
    confidence_interval_days: Number.isFinite(ci) ? Math.min(7, Math.max(3, Math.round(ci))) : 4,
    days_behind_typical: Number.isFinite(dbt) ? Math.round(dbt) : 0,
    risk_level,
    risk_factors: factors,
    recommendation: typeof o.recommendation === 'string' ? o.recommendation : '',
  };
}

export async function predictCloseDate(input: VelocityInput): Promise<VelocityPrediction> {
  const benchmark = input.avgDaysTotalUw ?? 21;
  const condList = input.openConditions.length
    ? input.openConditions.map((c) => `${c.category ?? 'other'}: ${c.condition_text}`).join('; ')
    : 'none open';

  const prompt = `You are a mortgage processing expert. Today is ${input.todayISO}.
Predict the close date for this loan and identify risk factors.

LOAN STATUS:
- Stage: ${input.stage}
- Days in current stage: ${input.daysInCurrentStage}
- Target close date: ${input.targetCloseDate ?? 'not set'}
- Open conditions (${input.openConditions.length}): ${condList}
- Loan program: ${input.loanProgram}
- Employment type: ${input.employmentType}
- Borrower behavior score (0-100, higher = more engaged): ${input.behaviorScore ?? 'unknown'}

HISTORICAL BENCHMARK:
- Avg days through full underwriting for similar loans: ${benchmark} days

Return JSON only:
{
  "predicted_close_date": "YYYY-MM-DD",
  "confidence_interval_days": 3-7,
  "days_behind_typical": number (negative = ahead of pace),
  "risk_level": "on_track|watch|at_risk|critical",
  "risk_factors": [{ "factor": string, "impact_days": number, "description": string }],
  "recommendation": "one actionable sentence for the loan officer"
}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = response.content[0];
  const text = block && block.type === 'text' ? block.text : '';
  return parsePrediction(text, input.todayISO);
}
