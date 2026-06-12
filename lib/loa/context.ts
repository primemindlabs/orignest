/**
 * LOA business-intelligence context assembly.
 *
 * Adapted to the real stack (Clerk auth + service-role admin client, NOT Supabase
 * auth/RLS). Scoping is app-layer: org_id + loId (= profiles.id = leads.assigned_to).
 *
 * PII SAFETY — these columns are NEVER selected anywhere in this file:
 *   ssn, last_name (borrower), dob, income, account_number, credit_score,
 *   bank_statements.
 * Borrowers only ever appear as aggregate counts here. Realtor names ARE included —
 * they are business contacts, not applicants (per the LOA privacy rules).
 *
 * Schema reality vs. the original spec:
 *   - No `ghost_scores` table (ghost score is an on-demand 0–10 computation). We
 *     surface an honest "no contact in 10+ days" proxy as `at_risk_count`.
 *   - `leads` has no `funded_at`/`user_id`; funded == stage 'closed', date is
 *     `closing_date`, ownership is `assigned_to`.
 *   - `trid_events` has no `resolved` flag; an open alert == `is_compliant = false`.
 *   - Realtor heat lives in `realtor_heat_scores` (score/band/days_since_last_contact);
 *     "hasn't sent a deal" uses `realtors.last_referral_at`.
 *   - Funnel bottleneck reuses lib/funnel/computeFunnel (Phase 99).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeFunnel } from '@/lib/funnel/compute';

type Admin = SupabaseClient<any, any, any>;

const DAY = 24 * 60 * 60 * 1000;
const NO_CONTACT_DAYS = 10; // active lead with no contact in 10+ days = at-risk

export interface LOAContext {
  pipeline: {
    active_loans: number;
    by_stage: Record<string, number>;
    total_pipeline_value: number;
    avg_close_time_days: number;
    at_risk_count: number; // active borrowers with no contact in 10+ days
    trid_alerts_count: number; // open (non-compliant) TRID events
  };
  realtors: {
    total_count: number;
    hot_count: number;
    warm_count: number;
    cooling_count: number;
    cold_count: number;
    not_sent_deal_60d: Array<{ name: string; days_since_deal: number }>;
  };
  performance: {
    loans_funded_30d: number;
    loans_funded_90d: number;
    volume_funded_30d: number;
    best_referral_source: string;
    worst_referral_source: string;
  };
  funnel: {
    bottleneck_stage: string | null;
    bottleneck_conversion_pct: number | null;
  };
}

const TERMINAL_STAGES = ['closed', 'declined', 'withdrawn'];

export async function assembleLOAContext(
  sb: Admin,
  orgId: string,
  loId: string
): Promise<LOAContext> {
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * DAY).toISOString();
  const ninetyDaysAgo = new Date(now - 90 * DAY).toISOString();
  const oneEightyDaysAgo = new Date(now - 180 * DAY).toISOString();

  // ── Pipeline: active leads, stage counts, value, at-risk ────────────────────
  const { data: activeLeads } = await sb
    .from('leads')
    .select('stage, loan_amount, last_contacted_at')
    .eq('org_id', orgId)
    .eq('assigned_to', loId)
    .not('stage', 'in', `(${TERMINAL_STAGES.join(',')})`);

  const byStage: Record<string, number> = {};
  let totalPipelineValue = 0;
  let atRiskCount = 0;
  const noContactCutoff = now - NO_CONTACT_DAYS * DAY;
  for (const lead of activeLeads ?? []) {
    const stage = (lead.stage as string) ?? 'unknown';
    byStage[stage] = (byStage[stage] ?? 0) + 1;
    totalPipelineValue += Number(lead.loan_amount ?? 0);
    const lastContact = lead.last_contacted_at
      ? new Date(lead.last_contacted_at as string).getTime()
      : null;
    if (lastContact === null || lastContact < noContactCutoff) atRiskCount++;
  }

  // ── Open TRID alerts (non-compliant events) ─────────────────────────────────
  const { count: tridAlertsCount } = await sb
    .from('trid_events')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('user_id', loId)
    .eq('is_compliant', false);

  // ── Avg time to close: closing_date - created_at over recent closings ────────
  const { data: closedLeads } = await sb
    .from('leads')
    .select('created_at, closing_date')
    .eq('org_id', orgId)
    .eq('assigned_to', loId)
    .eq('stage', 'closed')
    .gte('closing_date', oneEightyDaysAgo.slice(0, 10))
    .not('closing_date', 'is', null);

  let avgCloseTimeDays = 0;
  if (closedLeads && closedLeads.length > 0) {
    const spans = closedLeads
      .map((l) => {
        const created = new Date(l.created_at as string).getTime();
        const closed = new Date(l.closing_date as string).getTime();
        return Math.round((closed - created) / DAY);
      })
      .filter((d) => Number.isFinite(d) && d >= 0);
    if (spans.length > 0) {
      avgCloseTimeDays = Math.round(spans.reduce((a, b) => a + b, 0) / spans.length);
    }
  }

  // ── Realtors: band breakdown (heat scores) + dormant deal list (realtors) ────
  const { data: heat } = await sb
    .from('realtor_heat_scores')
    .select('band')
    .eq('org_id', orgId);

  let hotCount = 0;
  let warmCount = 0;
  let coolingCount = 0;
  let coldCount = 0;
  for (const h of heat ?? []) {
    switch (h.band as string) {
      case 'hot':
        hotCount++;
        break;
      case 'warm':
        warmCount++;
        break;
      case 'cooling':
        coolingCount++;
        break;
      default:
        coldCount++;
    }
  }

  const { data: realtors } = await sb
    .from('realtors')
    .select('first_name, last_name, last_referral_at')
    .eq('org_id', orgId)
    .eq('is_archived', false);

  const notSentDeal60d: Array<{ name: string; days_since_deal: number }> = [];
  for (const r of realtors ?? []) {
    if (!r.last_referral_at) continue; // never referred — not "stopped"
    const days = Math.floor((now - new Date(r.last_referral_at as string).getTime()) / DAY);
    if (days >= 60) {
      const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'Unknown realtor';
      notSentDeal60d.push({ name, days_since_deal: days });
    }
  }
  notSentDeal60d.sort((a, b) => b.days_since_deal - a.days_since_deal);

  // ── Performance: funded (closed) loans ──────────────────────────────────────
  const { data: funded30 } = await sb
    .from('leads')
    .select('loan_amount')
    .eq('org_id', orgId)
    .eq('assigned_to', loId)
    .eq('stage', 'closed')
    .gte('closing_date', thirtyDaysAgo.slice(0, 10));

  const { count: fundedCount90 } = await sb
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('assigned_to', loId)
    .eq('stage', 'closed')
    .gte('closing_date', ninetyDaysAgo.slice(0, 10));

  const loansFunded30d = funded30?.length ?? 0;
  const volumeFunded30d =
    funded30?.reduce((s, l) => s + Number(l.loan_amount ?? 0), 0) ?? 0;

  // ── Referral source performance (roi_snapshots, by close_rate) ──────────────
  const { data: roiSnaps } = await sb
    .from('roi_snapshots')
    .select('source_type, source_detail, close_rate, calculated_at')
    .eq('org_id', orgId)
    .eq('lo_id', loId)
    .order('calculated_at', { ascending: false })
    .limit(50);

  let bestSource = 'N/A';
  let worstSource = 'N/A';
  if (roiSnaps && roiSnaps.length > 0) {
    // Keep the most recent snapshot per source label, then rank by close_rate.
    const latestBySource = new Map<string, { label: string; rate: number }>();
    for (const s of roiSnaps) {
      const label = (s.source_detail as string) || (s.source_type as string) || 'unknown';
      if (!latestBySource.has(label)) {
        latestBySource.set(label, { label, rate: Number(s.close_rate ?? 0) });
      }
    }
    const ranked = Array.from(latestBySource.values()).sort((a, b) => b.rate - a.rate);
    if (ranked.length > 0) {
      bestSource = ranked[0].label;
      worstSource = ranked[ranked.length - 1].label;
    }
  }

  // ── Funnel bottleneck (reuse Phase 99 computeFunnel, 90-day window) ──────────
  let bottleneckStage: string | null = null;
  let bottleneckConversionPct: number | null = null;
  try {
    const funnel = await computeFunnel(sb, orgId, loId, 90);
    bottleneckStage = funnel.bottleneck_stage;
    bottleneckConversionPct = funnel.bottleneck_conversion_pct;
  } catch {
    // Insufficient transition data — leave nulls (LOA will say it lacks the data).
  }

  return {
    pipeline: {
      active_loans: activeLeads?.length ?? 0,
      by_stage: byStage,
      total_pipeline_value: totalPipelineValue,
      avg_close_time_days: avgCloseTimeDays,
      at_risk_count: atRiskCount,
      trid_alerts_count: tridAlertsCount ?? 0,
    },
    realtors: {
      total_count: realtors?.length ?? 0,
      hot_count: hotCount,
      warm_count: warmCount,
      cooling_count: coolingCount,
      cold_count: coldCount,
      not_sent_deal_60d: notSentDeal60d,
    },
    performance: {
      loans_funded_30d: loansFunded30d,
      loans_funded_90d: fundedCount90 ?? 0,
      volume_funded_30d: volumeFunded30d,
      best_referral_source: bestSource,
      worst_referral_source: worstSource,
    },
    funnel: {
      bottleneck_stage: bottleneckStage,
      bottleneck_conversion_pct: bottleneckConversionPct,
    },
  };
}

/**
 * Serializes LOAContext into a structured plain-text block for the Haiku prompt.
 * No PII ever enters this string.
 */
export function serializeContextForPrompt(ctx: LOAContext): string {
  const lines: string[] = [
    '=== PIPELINE ===',
    `Active loans: ${ctx.pipeline.active_loans}`,
    `By stage: ${JSON.stringify(ctx.pipeline.by_stage)}`,
    `Total pipeline value: $${(ctx.pipeline.total_pipeline_value / 1_000_000).toFixed(2)}M`,
    `Avg time to close (last 180d): ${ctx.pipeline.avg_close_time_days} days`,
    `At-risk borrowers (no contact in ${NO_CONTACT_DAYS}+ days): ${ctx.pipeline.at_risk_count}`,
    `Open TRID alerts (non-compliant): ${ctx.pipeline.trid_alerts_count}`,
    '',
    '=== REALTORS ===',
    `Total: ${ctx.realtors.total_count} | Hot: ${ctx.realtors.hot_count} | Warm: ${ctx.realtors.warm_count} | Cooling: ${ctx.realtors.cooling_count} | Cold: ${ctx.realtors.cold_count}`,
    `Haven't sent a deal in 60+ days (${ctx.realtors.not_sent_deal_60d.length}):`,
    ...ctx.realtors.not_sent_deal_60d.map(
      (r) => `  - ${r.name}: ${r.days_since_deal} days since last deal`
    ),
    '',
    '=== PERFORMANCE ===',
    `Loans funded (30d): ${ctx.performance.loans_funded_30d}`,
    `Loans funded (90d): ${ctx.performance.loans_funded_90d}`,
    `Volume funded (30d): $${(ctx.performance.volume_funded_30d / 1_000_000).toFixed(2)}M`,
    `Best referral source: ${ctx.performance.best_referral_source}`,
    `Worst referral source: ${ctx.performance.worst_referral_source}`,
    '',
    '=== FUNNEL ===',
    ctx.funnel.bottleneck_stage
      ? `Bottleneck stage: ${ctx.funnel.bottleneck_stage} (${ctx.funnel.bottleneck_conversion_pct}% conversion)`
      : 'Bottleneck stage: insufficient data',
  ];
  return lines.join('\n');
}
