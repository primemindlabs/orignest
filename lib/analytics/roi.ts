/**
 * Phase 98 — ROI math. PURE (no deps beyond the cost type). Ported verbatim from
 * the spec; the only adaptation is downstream (gross comp is derived elsewhere).
 */
import type { ReferralSourceCost } from '@/types/analytics';

/** ROI multiple: dollars returned per dollar spent. null when no cost (organic). */
export function calculateROI(grossComp: number, totalCost: number): number | null {
  if (totalCost === 0) return null;
  return Math.round((grossComp / totalCost) * 10) / 10;
}

/** Cost per closed loan. null when nothing has closed. */
export function costPerClosed(totalCost: number, closedCount: number): number | null {
  if (closedCount === 0) return null;
  return Math.round(totalCost / closedCount);
}

/** Close rate as a percentage (e.g. 68.50). null when there are no leads. */
export function closeRate(closedCount: number, leadsCount: number): number | null {
  if (leadsCount === 0) return null;
  return Math.round((closedCount / leadsCount) * 10000) / 100;
}

/** Prorated cost for a period. monthly = daily rate × days; per_lead × leads; one_time = full. */
export function totalCostForPeriod(cost: ReferralSourceCost, periodDays: number, leadsCount: number): number {
  switch (cost.cost_period) {
    case 'monthly': return (cost.cost_amount / 30) * periodDays;
    case 'per_lead': return cost.cost_amount * leadsCount;
    case 'one_time': return cost.cost_amount;
    default: return 0;
  }
}

export type ROITier = 'none' | 'strong' | 'moderate' | 'weak';

export function roiTier(roiMultiple: number | null): ROITier {
  if (roiMultiple === null) return 'none';
  if (roiMultiple >= 3) return 'strong';
  if (roiMultiple >= 1) return 'moderate';
  return 'weak';
}

/** 4.2 -> "4.2x", null -> "—" */
export function formatROI(roiMultiple: number | null): string {
  return roiMultiple === null ? '—' : `${roiMultiple}x`;
}

/** 68.5 -> "69%", null -> "—" */
export function formatCloseRate(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate)}%`;
}

const USD0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** 1250 -> "$1,250", null -> "—" */
export function formatCostPerClosed(cost: number | null): string {
  return cost === null ? '—' : USD0.format(cost);
}

/** 3600 -> "$3,600" */
export function formatUSD(n: number): string {
  return USD0.format(n);
}
