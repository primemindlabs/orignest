/**
 * Phase 98 — referral ROI aggregation (server). Shared by the live GET route and
 * the weekly cron. Per-LO within an org.
 *
 * gross comp (no gross_comp column exists) = loan_amount * comp_rate/100, matching
 * the pipeline money-bar. Realtor auto-attribution: a lead with referral_realtor_id
 * but no referral_source counts as 'realtor' (read-time only — never written back).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateROI, closeRate, costPerClosed, totalCostForPeriod } from '@/lib/analytics/roi';
import type { ReferralROIRow, ReferralSourceCost } from '@/types/analytics';

type Admin = ReturnType<typeof createAdminClient>;
const DAY = 86_400_000;
const dateStr = (d: Date) => d.toISOString().split('T')[0];

interface Bucket {
  source_type: string;
  source_detail: string | null;
  leads_count: number;
  closed_count: number;
  total_gross_comp: number;
}

export async function computeReferralROI(
  sb: Admin,
  orgId: string,
  loId: string,
  periodDays: number,
): Promise<{ rows: ReferralROIRow[]; period_start: string; period_end: string }> {
  const now = Date.now();
  const periodStart = dateStr(new Date(now - periodDays * DAY));
  const periodEnd = dateStr(new Date(now));

  const [{ data: leads }, { data: profile }, { data: costRows }] = await Promise.all([
    sb.from('leads')
      .select('id, referral_source, referral_source_detail, referral_realtor_id, loan_amount, stage')
      .eq('org_id', orgId).eq('assigned_to', loId).gte('created_at', `${periodStart}T00:00:00Z`),
    sb.from('profiles').select('comp_rate').eq('id', loId).maybeSingle(),
    sb.from('referral_source_costs').select('*').eq('org_id', orgId).eq('lo_id', loId),
  ]);

  const compRate = Number(profile?.comp_rate ?? 0.5); // percent of loan amount
  const leadList = leads ?? [];

  // Realtor names for leads attributed via referral_realtor_id (no explicit source).
  const realtorIds = Array.from(new Set(
    leadList.filter((l) => !l.referral_source && l.referral_realtor_id).map((l) => l.referral_realtor_id as string),
  ));
  const realtorName = new Map<string, string>();
  if (realtorIds.length) {
    const { data: realtors } = await sb.from('realtors').select('id, first_name, last_name').in('id', realtorIds);
    for (const r of realtors ?? []) realtorName.set(r.id, `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'Realtor');
  }

  // Bucket leads by effective (source_type, source_detail).
  const buckets = new Map<string, Bucket>();
  for (const l of leadList) {
    let sourceType = (l.referral_source as string | null) ?? null;
    let detail = (l.referral_source_detail as string | null) ?? null;
    if (!sourceType && l.referral_realtor_id) {
      sourceType = 'realtor';
      detail = detail ?? realtorName.get(l.referral_realtor_id as string) ?? null;
    }
    if (!sourceType) sourceType = 'untagged'; // display-only bucket for visibility
    const key = `${sourceType}|${detail ?? ''}`;
    const b = buckets.get(key) ?? { source_type: sourceType, source_detail: detail, leads_count: 0, closed_count: 0, total_gross_comp: 0 };
    b.leads_count += 1;
    if (l.stage === 'closed') {
      b.closed_count += 1;
      b.total_gross_comp += (Number(l.loan_amount ?? 0) * compRate) / 100;
    }
    buckets.set(key, b);
  }

  // Costs active during the period.
  const costs = (costRows ?? []).filter((c) =>
    c.active_from <= periodEnd && (c.active_to === null || c.active_to >= periodStart),
  ) as ReferralSourceCost[];

  const rows: ReferralROIRow[] = Array.from(buckets.values()).map((b) => {
    const matching = costs.filter((c) => c.source_type === b.source_type && (c.source_detail === null || c.source_detail === b.source_detail));
    const totalCost = matching.reduce((sum, c) => sum + totalCostForPeriod(c, periodDays, b.leads_count), 0);
    const roundedComp = Math.round(b.total_gross_comp);
    return {
      source_type: b.source_type,
      source_detail: b.source_detail,
      leads_count: b.leads_count,
      closed_count: b.closed_count,
      close_rate: closeRate(b.closed_count, b.leads_count),
      total_cost: Math.round(totalCost),
      total_gross_comp: roundedComp,
      cost_per_closed: costPerClosed(Math.round(totalCost), b.closed_count),
      roi_multiple: totalCost > 0 ? calculateROI(roundedComp, Math.round(totalCost)) : null,
    };
  });

  // Sort by ROI desc, nulls last.
  rows.sort((a, b) => {
    if (a.roi_multiple === null && b.roi_multiple === null) return b.total_gross_comp - a.total_gross_comp;
    if (a.roi_multiple === null) return 1;
    if (b.roi_multiple === null) return -1;
    return b.roi_multiple - a.roi_multiple;
  });

  return { rows, period_start: periodStart, period_end: periodEnd };
}
