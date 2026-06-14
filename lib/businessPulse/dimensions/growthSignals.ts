/**
 * Pulse dimension — Growth Signals (5%).
 * New referral partners added MTD + lead-creation momentum (projected month vs prior
 * month) + referral-sourced share. (Spec's Arrive-conversion is omitted: leads.referral_source
 * has no 'arrive' value in this schema.)
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { clamp, NEUTRAL, type DimensionResult } from '../types';

const DAY = 86_400_000;

export async function growthSignals(sb: SupabaseClient, orgId: string): Promise<DimensionResult> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const cut90 = new Date(now.getTime() - 90 * DAY).toISOString();
  const startMonthIso = startOfMonth.toISOString();
  const startPrevIso = startPrevMonth.toISOString();

  const [{ data: realtors }, { data: recentLeads }] = await Promise.all([
    sb.from('realtors').select('id, created_at, is_archived').eq('org_id', orgId).gte('created_at', startMonthIso),
    sb.from('leads').select('created_at, referral_source').eq('org_id', orgId).gte('created_at', cut90),
  ]);

  const newRealtorsMtd = (realtors ?? []).filter((r: any) => !r.is_archived).length;

  const leads90 = (recentLeads ?? []) as { created_at: string; referral_source: string | null }[];
  const leadsMtd = leads90.filter((l) => l.created_at >= startMonthIso).length;
  const leadsPrevMonth = leads90.filter((l) => l.created_at >= startPrevIso && l.created_at < startMonthIso).length;
  const referralLeads = leads90.filter((l) => l.referral_source === 'realtor' || l.referral_source === 'referral').length;
  const referralSharePct = leads90.length ? Math.round((referralLeads / leads90.length) * 100) : null;

  let score: number;
  if (leads90.length === 0 && newRealtorsMtd === 0) {
    score = NEUTRAL;
  } else {
    // Lead momentum: project the month, compare to last month (flat ≈ 70).
    const dayOfMonth = now.getUTCDate();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const projectedLeads = leadsMtd / Math.max(dayOfMonth / daysInMonth, 0.1);
    const momentum = leadsPrevMonth > 0 ? clamp((projectedLeads / leadsPrevMonth) * 70) : 70;
    const partnerBonus = Math.min(20, newRealtorsMtd * 5);
    const referralBonus = referralSharePct != null ? Math.min(10, referralSharePct / 10) : 0;
    score = clamp(Math.round(momentum + partnerBonus + referralBonus));
  }

  return {
    score: clamp(score),
    details: {
      new_realtors_mtd: newRealtorsMtd,
      new_leads_mtd: leadsMtd,
      prior_month_leads: leadsPrevMonth,
      referral_share_pct: referralSharePct,
    },
  };
}
