/**
 * Phase 78 — pure report aggregations.
 *
 * The spec put this math in Postgres RPCs keyed on columns this schema doesn't have
 * (leads.user_id/funded_at/realtor_id, stages 'funded'/'ctc'). We compute in TS over
 * fetched rows instead — the established pattern here (dashboard/pipeline do the same)
 * — mapped to the REAL columns: stage 'closed' = funded, close date =
 * actual_close_date ?? closing_date, link = referral_realtor_id, scope = org/assigned_to.
 */
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  startOfDay,
  endOfDay,
  differenceInCalendarDays,
  subDays,
  format,
} from 'date-fns';

export interface RLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  stage: string;
  loan_amount: number | null;
  loan_type: string | null;
  lead_source: string | null;
  created_at: string;
  closing_date: string | null;
  actual_close_date: string | null;
  stage_changed_at: string | null;
  assigned_to: string | null;
  referral_realtor_id: string | null;
}

export interface RRealtor {
  id: string;
  first_name: string | null;
  last_name: string | null;
  brokerage_name: string | null;
}

export interface RProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  comp_rate: number | null;
  monthly_volume_goal: number | null;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

const STAGE_RANK: Record<string, number> = {
  new_inquiry: 0, pre_qual: 1, application: 2, processing: 3, underwriting: 4, conditional_approval: 5, clear_to_close: 6, closed: 7,
};

export const STAGE_LABEL: Record<string, string> = {
  new_inquiry: 'New inquiry', pre_qual: 'Pre-qual', application: 'Application', processing: 'Processing',
  underwriting: 'Underwriting', conditional_approval: 'Cond. approval', clear_to_close: 'CTC', closed: 'Funded',
};

const MONEY_BAR_COLOR: Record<string, string> = {
  new_inquiry: '#F5EFE0', pre_qual: '#EAD9B8', application: '#D9C490', processing: '#C9A95C',
  underwriting: '#A88440', conditional_approval: '#8E6E2E', clear_to_close: '#7A5C10',
};

// ── date ranges ───────────────────────────────────────────────────────────────
export type RangePreset = 'this_month' | 'last_month' | 'q1' | 'q2' | 'q3' | 'q4' | 'ytd';

export function presetRange(preset: RangePreset, now: Date): DateRange {
  const y = now.getFullYear();
  switch (preset) {
    case 'this_month': return { start: startOfMonth(now), end: endOfDay(now) };
    case 'last_month': { const m = subMonths(now, 1); return { start: startOfMonth(m), end: endOfMonth(m) }; }
    case 'q1': return { start: startOfDay(new Date(y, 0, 1)), end: endOfDay(new Date(y, 2, 31)) };
    case 'q2': return { start: startOfDay(new Date(y, 3, 1)), end: endOfDay(new Date(y, 5, 30)) };
    case 'q3': return { start: startOfDay(new Date(y, 6, 1)), end: endOfDay(new Date(y, 8, 30)) };
    case 'q4': return { start: startOfDay(new Date(y, 9, 1)), end: endOfDay(new Date(y, 11, 31)) };
    case 'ytd': return { start: startOfYear(now), end: endOfDay(now) };
  }
}

export function priorRange(r: DateRange): DateRange {
  const len = differenceInCalendarDays(r.end, r.start);
  return { start: subDays(r.start, len + 1), end: subDays(r.start, 1) };
}

// ── helpers ─────────────────────────────────────────────────────────────────
export function closeDate(l: RLead): Date | null {
  const d = l.actual_close_date ?? l.closing_date;
  return d ? new Date(d) : null;
}
const inRange = (d: Date | null, r: DateRange) => !!d && d >= r.start && d <= r.end;
export const isFunded = (l: RLead) => l.stage === 'closed';
const fundedInRange = (l: RLead, r: DateRange) => isFunded(l) && inRange(closeDate(l), r);
const createdInRange = (l: RLead, r: DateRange) => inRange(new Date(l.created_at), r);

export const fullName = (first: string | null, last: string | null) => `${first ?? ''} ${last ?? ''}`.trim() || '—';

export function fmtDollars(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

const sumAmt = (ls: RLead[]) => ls.reduce((s, l) => s + (l.loan_amount ?? 0), 0);

// ── money bar (current pipeline by stage) ─────────────────────────────────────
export function pipelineByStage(leads: RLead[]): { label: string; volume: number; color: string }[] {
  return ACTIVE_STAGES.map((s) => ({
    label: STAGE_LABEL[s],
    color: MONEY_BAR_COLOR[s],
    volume: sumAmt(leads.filter((l) => l.stage === s)),
  }));
}

// ── overview metrics + prior-period deltas ────────────────────────────────────
export interface OverviewMetrics {
  fundedVolume: number;
  fundedCount: number;
  avgLoanSize: number;
  pullThrough: number | null;
  avgDaysToClose: number | null;
}

export function overviewMetrics(leads: RLead[], r: DateRange): OverviewMetrics {
  const funded = leads.filter((l) => fundedInRange(l, r));
  const created = leads.filter((l) => createdInRange(l, r));
  const fundedVolume = sumAmt(funded);
  const days = funded
    .map((l) => { const c = closeDate(l); return c ? differenceInCalendarDays(c, new Date(l.created_at)) : null; })
    .filter((d): d is number => d != null);
  return {
    fundedVolume,
    fundedCount: funded.length,
    avgLoanSize: funded.length ? fundedVolume / funded.length : 0,
    pullThrough: created.length ? (funded.length / created.length) * 100 : null,
    avgDaysToClose: days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : null,
  };
}

/** percentage delta of current vs prior (null if prior is 0/absent) */
export function pctDelta(cur: number, prior: number): number | null {
  if (!prior) return null;
  return Math.round(((cur - prior) / prior) * 100);
}

// ── monthly funded volume (last 12 months) ────────────────────────────────────
export function monthlyVolume(leads: RLead[], now: Date): { month: string; monthLabel: string; volume: number }[] {
  const out: { month: string; monthLabel: string; volume: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = subMonths(now, i);
    const s = startOfMonth(m), e = endOfMonth(m);
    const volume = sumAmt(leads.filter((l) => isFunded(l) && inRange(closeDate(l), { start: s, end: e })));
    out.push({ month: format(m, 'yyyy-MM'), monthLabel: format(m, 'MMM'), volume });
  }
  return out;
}

// ── stage funnel (cumulative reached, leads created in range) ─────────────────
export function stageFunnel(leads: RLead[], r: DateRange): { stage: string; label: string; count: number; dropoff: number | null }[] {
  const scoped = leads.filter((l) => createdInRange(l, r) && STAGE_RANK[l.stage] != null);
  const order = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'clear_to_close', 'closed'];
  let prev: number | null = null;
  return order.map((s) => {
    const rank = STAGE_RANK[s];
    const count = scoped.filter((l) => STAGE_RANK[l.stage] >= rank).length;
    const dropoff = prev != null && prev > 0 ? Math.round((1 - count / prev) * 100) : null;
    prev = count;
    return { stage: s, label: STAGE_LABEL[s], count, dropoff };
  });
}

// ── recent funded loans ───────────────────────────────────────────────────────
export interface FundedRow {
  id: string; borrower: string; loan_amount: number; loan_type: string; realtor: string;
  funded: string | null; days_to_close: number | null; commission: number;
}

export function recentFunded(leads: RLead[], realtorById: Map<string, RRealtor>, r: DateRange, compRate: number, limit = 10): FundedRow[] {
  return leads
    .filter((l) => fundedInRange(l, r))
    .sort((a, b) => (closeDate(b)?.getTime() ?? 0) - (closeDate(a)?.getTime() ?? 0))
    .slice(0, limit)
    .map((l) => {
      const c = closeDate(l);
      const rt = l.referral_realtor_id ? realtorById.get(l.referral_realtor_id) : null;
      return {
        id: l.id,
        borrower: fullName(l.first_name, l.last_name),
        loan_amount: l.loan_amount ?? 0,
        loan_type: l.loan_type ?? '—',
        realtor: rt ? fullName(rt.first_name, rt.last_name) : '—',
        funded: c ? format(c, 'MMM d, yyyy') : null,
        days_to_close: c ? differenceInCalendarDays(c, new Date(l.created_at)) : null,
        commission: (l.loan_amount ?? 0) * (compRate / 100),
      };
    });
}

// ── pipeline rows (active loans) ──────────────────────────────────────────────
export interface PipelineRow {
  id: string; borrower: string; loan_amount: number; stage: string; stage_label: string;
  stage_age: number | null; realtor: string; realtor_id: string | null; loan_type: string;
  source: string; est_close: string | null; est_close_soon: boolean; commission: number;
}

export function pipelineRows(leads: RLead[], realtorById: Map<string, RRealtor>, compRate: number, now: Date): PipelineRow[] {
  return leads
    .filter((l) => ACTIVE_STAGES.includes(l.stage))
    .map((l) => {
      const since = l.stage_changed_at ?? l.created_at;
      const est = l.closing_date ? new Date(l.closing_date) : null;
      const rt = l.referral_realtor_id ? realtorById.get(l.referral_realtor_id) : null;
      return {
        id: l.id,
        borrower: fullName(l.first_name, l.last_name),
        loan_amount: l.loan_amount ?? 0,
        stage: l.stage,
        stage_label: STAGE_LABEL[l.stage] ?? l.stage,
        stage_age: since ? differenceInCalendarDays(now, new Date(since)) : null,
        realtor: rt ? fullName(rt.first_name, rt.last_name) : '—',
        realtor_id: l.referral_realtor_id,
        loan_type: l.loan_type ?? '—',
        source: l.lead_source ?? '—',
        est_close: est ? format(est, 'MMM d') : null,
        est_close_soon: est ? differenceInCalendarDays(est, now) >= 0 && differenceInCalendarDays(est, now) <= 7 : false,
        commission: (l.loan_amount ?? 0) * (compRate / 100),
      };
    });
}

export function slowestStage(leads: RLead[], now: Date): { label: string; avgDays: number } | null {
  const byStage: Record<string, number[]> = {};
  for (const l of leads.filter((x) => ACTIVE_STAGES.includes(x.stage))) {
    const since = l.stage_changed_at ?? l.created_at;
    if (!since) continue;
    (byStage[l.stage] ??= []).push(differenceInCalendarDays(now, new Date(since)));
  }
  let best: { label: string; avgDays: number } | null = null;
  for (const [s, arr] of Object.entries(byStage)) {
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    if (!best || avg > best.avgDays) best = { label: STAGE_LABEL[s] ?? s, avgDays: avg };
  }
  return best;
}

// ── partner performance ───────────────────────────────────────────────────────
export interface PartnerRow {
  id: string; name: string; brokerage: string; referrals: number; funded_count: number;
  pipeline_volume: number; funded_volume: number; pull_through: number | null; avg_loan_size: number;
}

export function partnerPerformance(leads: RLead[], realtors: RRealtor[], r: DateRange): PartnerRow[] {
  return realtors
    .map((rt) => {
      const ls = leads.filter((l) => l.referral_realtor_id === rt.id);
      const referrals = ls.filter((l) => createdInRange(l, r)).length;
      const funded = ls.filter((l) => fundedInRange(l, r));
      const fundedVol = sumAmt(funded);
      return {
        id: rt.id,
        name: fullName(rt.first_name, rt.last_name),
        brokerage: rt.brokerage_name ?? '—',
        referrals,
        funded_count: funded.length,
        pipeline_volume: sumAmt(ls.filter((l) => ACTIVE_STAGES.includes(l.stage))),
        funded_volume: fundedVol,
        pull_through: referrals ? (funded.length / referrals) * 100 : null,
        avg_loan_size: funded.length ? fundedVol / funded.length : 0,
      };
    })
    .filter((p) => p.referrals > 0 || p.funded_count > 0 || p.pipeline_volume > 0)
    .sort((a, b) => b.funded_volume - a.funded_volume);
}

// ── team performance (BM) ─────────────────────────────────────────────────────
export interface TeamRow {
  id: string; name: string; funded_volume: number; funded_count: number;
  pull_through: number | null; avg_days: number | null; goal: number | null; goal_pct: number | null;
}

export function teamPerformance(leads: RLead[], team: RProfile[], r: DateRange): TeamRow[] {
  return team
    .map((p) => {
      const ls = leads.filter((l) => l.assigned_to === p.id);
      const m = overviewMetrics(ls, r);
      const goal = p.monthly_volume_goal != null ? Number(p.monthly_volume_goal) : null;
      return {
        id: p.id,
        name: fullName(p.first_name, p.last_name),
        funded_volume: m.fundedVolume,
        funded_count: m.fundedCount,
        pull_through: m.pullThrough,
        avg_days: m.avgDaysToClose,
        goal,
        goal_pct: goal && goal > 0 ? (m.fundedVolume / goal) * 100 : null,
      };
    })
    .sort((a, b) => b.funded_volume - a.funded_volume);
}
