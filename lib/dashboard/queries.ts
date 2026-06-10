/**
 * Phase 75 — Dashboard derivations.
 *
 * PURE helpers that turn already-fetched lead rows into the shapes the dashboard
 * widgets render. Fetching (and persona/scope filtering) happens in the page;
 * keeping the math here makes it testable and avoids N+1 Supabase round-trips.
 *
 * Adapted to the REAL leads schema:
 *   - close target  → `closing_date`            (no expected_close_date)
 *   - last touch    → `last_contacted_at`       (no last_activity_at)
 *   - "CTC"         → `clear_to_close`           (no 'ctc' / 'funded' stage)
 *   - conditions    → counted from loan_conditions (no denormalized column)
 *   - rate-lock alerts are omitted (no rate-lock date on leads)
 */
import { differenceInCalendarDays, isThisMonth, isSameMonth, startOfWeek, subWeeks } from 'date-fns';

export interface DashLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  stage: string;
  loan_amount: number | null;
  closing_date: string | null;
  last_contacted_at: string | null;
  stage_changed_at: string | null;
  created_at: string;
}

export const ACTIVE_STAGES = [
  'new_inquiry',
  'pre_qual',
  'application',
  'processing',
  'underwriting',
  'conditional_approval',
  'clear_to_close',
];
export const TERMINAL_STAGES = ['closed', 'declined', 'withdrawn'];
export const CLOSING_STAGES = ['processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

export const DASH_STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New',
  pre_qual: 'Pre-qual',
  application: 'App',
  processing: 'Processing',
  underwriting: 'UW',
  conditional_approval: 'Cond.',
  clear_to_close: 'CTC',
};

// Gold-anchored stage ramp (cool → gold → terra → green), no navy.
export const DASH_STAGE_COLORS: Record<string, string> = {
  new_inquiry: '#cbd5e1',
  pre_qual: '#94a3b8',
  application: '#fde68a',
  processing: '#C9A95C',
  underwriting: '#C4724A',
  conditional_approval: '#b08968',
  clear_to_close: '#1a7a3c',
};

export interface PipelineStageDatum {
  stage: string;
  label: string;
  count: number;
  color: string;
}

export function derivePipelineByStage(activeLeads: DashLead[]): PipelineStageDatum[] {
  return ACTIVE_STAGES.map((stage) => ({
    stage,
    label: DASH_STAGE_LABELS[stage] ?? stage,
    count: activeLeads.filter((l) => l.stage === stage).length,
    color: DASH_STAGE_COLORS[stage] ?? '#C9A95C',
  })).filter((d) => d.count > 0);
}

export type AlertType = 'stalled' | 'conditions';

export interface LeadAlert {
  type: AlertType;
  detail: string;
}

/** One alert per lead — outstanding conditions take priority over a stale touch. */
export function leadAlert(lead: DashLead, conditionCount: number, now: Date): LeadAlert | null {
  if (conditionCount > 0) return { type: 'conditions', detail: String(conditionCount) };

  const lastTouch = lead.last_contacted_at ?? lead.stage_changed_at ?? lead.created_at;
  if (lastTouch) {
    const d = differenceInCalendarDays(now, new Date(lastTouch));
    if (d > 5) return { type: 'stalled', detail: `${d}d` };
  }
  return null;
}

export interface AlertedLead {
  id: string;
  name: string;
  stage: string;
  alertType: AlertType;
  alertDetail: string;
}

export function deriveAlertedLeads(
  activeLeads: DashLead[],
  conditionCountByLead: Record<string, number>,
  now: Date,
  limit: number
): AlertedLead[] {
  return activeLeads
    .map((l) => {
      const alert = leadAlert(l, conditionCountByLead[l.id] ?? 0, now);
      if (!alert) return null;
      return {
        id: l.id,
        name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Unnamed lead',
        stage: l.stage,
        alertType: alert.type,
        alertDetail: alert.detail,
      };
    })
    .filter((x): x is AlertedLead => x !== null)
    .slice(0, limit);
}

export function countAlerts(
  activeLeads: DashLead[],
  conditionCountByLead: Record<string, number>,
  now: Date
): number {
  return activeLeads.filter((l) => leadAlert(l, conditionCountByLead[l.id] ?? 0, now) !== null).length;
}

export interface WeeklyVolume {
  weekStart: string;
  volume: number;
}

/** Bucket closed loans by the week of their closing_date, for the last `weeks` weeks. */
export function deriveWeeklyVolume(closedLeads: DashLead[], now: Date, weeks: number): WeeklyVolume[] {
  const buckets: WeeklyVolume[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const wStart = startOfWeek(subWeeks(now, i));
    const wEnd = startOfWeek(subWeeks(now, i - 1));
    const volume = closedLeads
      .filter((l) => {
        if (!l.closing_date) return false;
        const d = new Date(l.closing_date);
        return d >= wStart && d < wEnd;
      })
      .reduce((sum, l) => sum + (l.loan_amount ?? 0), 0);
    buckets.push({ weekStart: wStart.toISOString(), volume });
  }
  return buckets;
}

export interface DashboardMetrics {
  mtdVolume: number;
  mtdLoanCount: number;
  closingVolume: number;
  closingCount: number;
  estimatedCommission: number;
  compRate: number;
  pullThrough: number | null;
  pullThroughDelta: number | null;
  alertCount: number;
}

/**
 * @param closedThisMonth  leads with stage 'closed' whose closing_date is in the current month
 * @param terminal90       all terminal leads (closed/declined/withdrawn) in the trailing 90d window
 */
export function deriveMetrics(params: {
  activeLeads: DashLead[];
  closedThisMonth: DashLead[];
  terminal90: DashLead[];
  conditionCountByLead: Record<string, number>;
  compRate: number;
  now: Date;
}): DashboardMetrics {
  const { activeLeads, closedThisMonth, terminal90, conditionCountByLead, compRate, now } = params;

  const mtdVolume = closedThisMonth.reduce((s, l) => s + (l.loan_amount ?? 0), 0);
  const mtdLoanCount = closedThisMonth.length;

  const closing = activeLeads.filter(
    (l) => l.closing_date && isThisMonth(new Date(l.closing_date)) && CLOSING_STAGES.includes(l.stage)
  );
  const closingVolume = closing.reduce((s, l) => s + (l.loan_amount ?? 0), 0);

  // Pull-through over the trailing 90d terminal set: closed / (closed + declined + withdrawn).
  const closed90 = terminal90.filter((l) => l.stage === 'closed').length;
  const dead90 = terminal90.length - closed90;
  const denom = closed90 + dead90;
  const pullThrough = denom > 0 ? closed90 / denom : null;

  return {
    mtdVolume,
    mtdLoanCount,
    closingVolume,
    closingCount: closing.length,
    estimatedCommission: mtdVolume * (compRate / 100),
    compRate,
    pullThrough,
    pullThroughDelta: null, // no historical baseline stored — never fabricated
    alertCount: countAlerts(activeLeads, conditionCountByLead, now),
  };
}

export interface OperationsStats {
  filesInQueue: number;
  conditionsOutstanding: number;
  tasksDueToday: number;
  closingThisMonth: number;
}

export function deriveOperationsStats(params: {
  activeLeads: DashLead[];
  conditionCountByLead: Record<string, number>;
  tasksDueToday: number;
  now: Date;
}): OperationsStats {
  const { activeLeads, conditionCountByLead, tasksDueToday, now } = params;
  return {
    filesInQueue: activeLeads.length,
    conditionsOutstanding: Object.values(conditionCountByLead).reduce((s, n) => s + n, 0),
    tasksDueToday,
    closingThisMonth: activeLeads.filter(
      (l) => l.closing_date && isSameMonth(new Date(l.closing_date), now) && CLOSING_STAGES.includes(l.stage)
    ).length,
  };
}
