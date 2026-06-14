/**
 * Phase 130 — plain-English Pulse insights. Deterministic template by default
 * (works with zero AI dependency); if ANTHROPIC_API_KEY is set, Claude Haiku
 * rephrases the same facts into tighter bullets, falling back to the template on
 * any error. Mirrors the app's standard AI pattern (lib/ai/closingPost).
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { DimensionResult, PulseInsights, ScoreBand } from './types';

const MODEL = 'claude-haiku-4-5';

export interface InsightInput {
  pulseScore: number;
  scoreBand: ScoreBand;
  pipeline: DimensionResult;
  relationship: DimensionResult;
  revenue: DimensionResult;
  compliance: DimensionResult;
  growth: DimensionResult;
}

function money(n: unknown): string {
  const v = Number(n ?? 0);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v)}`;
}

/** Deterministic fallback — always produces useful bullets from the raw details. */
export function buildTemplateInsights(input: InsightInput): PulseInsights {
  const { pipeline, relationship, revenue, compliance, growth } = input;
  const risks: string[] = [];
  const wins: string[] = [];
  const key: string[] = [];

  const p = pipeline.details as any;
  const r = relationship.details as any;
  const rev = revenue.details as any;
  const c = compliance.details as any;
  const g = growth.details as any;

  // ── Risks (dragging dimensions) ──
  if (pipeline.score < 65) {
    if (p.avg_stage_age_days != null) risks.push(`Pipeline slowing — ${p.avg_stage_age_days}d avg in stage vs ${p.benchmark_days}d target`);
    if (p.at_risk_count > 0) risks.push(`${p.at_risk_count} file${p.at_risk_count === 1 ? '' : 's'} at fallout risk (close prob < 30%)`);
    for (const f of (p.stale_files ?? []).slice(0, 2)) risks.push(`${f.name} stuck in ${String(f.stage).replace(/_/g, ' ')} for ${f.days}d`);
  }
  if (relationship.score < 65 && r.realtors_hot_warm_pct != null) {
    risks.push(`Only ${r.realtors_hot_warm_pct}% of realtors are Hot/Warm`);
    for (const name of (r.cold_realtors ?? []).slice(0, 2)) risks.push(`${name} has cooled off — overdue for contact`);
  }
  if (revenue.score < 65 && rev.target_volume > 0) {
    risks.push(`Revenue pace behind — projecting ${money(rev.projected_month_volume)} vs ${money(rev.target_volume)} target`);
  }
  if (compliance.score < 65) {
    if (c.trid_compliance_pct != null) risks.push(`TRID compliance at ${c.trid_compliance_pct}%`);
    if (c.nmls_current_pct != null && c.nmls_current_pct < 100) risks.push(`${c.nmls_current_pct}% of LOs have current NMLS licenses`);
  }
  if (growth.score < 60 && g.prior_month_leads > 0) {
    risks.push(`Lead flow slowing — ${g.new_leads_mtd} new this month vs ${g.prior_month_leads} last month`);
  }

  // ── Wins (strong dimensions) ──
  if (revenue.score >= 80 && rev.prior_90d_avg_monthly > 0 && rev.projected_month_volume > rev.prior_90d_avg_monthly) {
    const pct = Math.round((rev.projected_month_volume / rev.prior_90d_avg_monthly - 1) * 100);
    if (pct > 0) wins.push(`Volume pacing ${pct}% ahead of your 90-day average`);
  }
  if (relationship.score >= 80 && r.realtors_hot_warm_pct != null) wins.push(`${r.realtors_hot_warm_pct}% of realtor partners are Hot/Warm`);
  if (pipeline.score >= 85 && p.avg_stage_age_days != null) wins.push(`Pipeline moving fast — ${p.avg_stage_age_days}d avg in stage`);
  if (compliance.score >= 95) wins.push(`Compliance posture is clean across the board`);
  if (g.new_realtors_mtd > 0) wins.push(`${g.new_realtors_mtd} new referral partner${g.new_realtors_mtd === 1 ? '' : 's'} added this month`);

  // ── Key facts (mixed) ──
  if (rev.funded_count_mtd != null) key.push(`${rev.funded_count_mtd} loan${rev.funded_count_mtd === 1 ? '' : 's'} funded MTD (${money(rev.mtd_volume)})`);
  if (p.active_count != null) key.push(`${p.active_count} active files in the pipeline`);
  if (rev.mtd_comp != null) key.push(`${money(rev.mtd_comp)} projected MTD commission`);
  if (r.borrowers_scored > 0 && r.borrower_heat_avg != null) key.push(`Avg borrower heat ${r.borrower_heat_avg}/100 across ${r.borrowers_scored} borrowers`);

  return {
    key: key.slice(0, 5),
    risks: risks.slice(0, 5),
    wins: wins.slice(0, 4),
  };
}

export async function generatePulseInsights(input: InsightInput): Promise<PulseInsights> {
  const template = buildTemplateInsights(input);
  if (!process.env.ANTHROPIC_API_KEY) return template;

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const payload = {
      pulse: input.pulseScore,
      band: input.scoreBand,
      dimensions: {
        pipeline: { score: input.pipeline.score, ...input.pipeline.details },
        relationships: { score: input.relationship.score, ...input.relationship.details },
        revenue: { score: input.revenue.score, ...input.revenue.details },
        compliance: { score: input.compliance.score, ...input.compliance.details },
        growth: { score: input.growth.score, ...input.growth.details },
      },
    };
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 700,
      system:
        'You are a brokerage operations analyst. Given a JSON snapshot of a mortgage branch\'s daily health score and its five dimensions, write concise, specific, plain-English bullets for a branch manager. Reference real numbers from the data. Never invent facts. Respond ONLY with minified JSON: {"key":[..],"risks":[..],"wins":[..]}. 3-5 key, up to 5 risks, up to 4 wins. Each bullet under 90 chars.',
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
    const text = msg.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return template;
    const parsed = JSON.parse(text.text.trim());
    const arr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s) => typeof s === 'string').slice(0, 5) : []);
    const out = { key: arr(parsed.key), risks: arr(parsed.risks), wins: arr(parsed.wins) };
    if (out.key.length === 0 && out.risks.length === 0 && out.wins.length === 0) return template;
    return out;
  } catch {
    return template;
  }
}
