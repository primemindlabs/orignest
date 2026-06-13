import { TRIDStatus, TRIDStatusValue } from '@/types';
import { isFederalHoliday } from '@/lib/compliance/federalHolidays';

/**
 * TRID "business day" definition (12 CFR 1026.2(a)(6)):
 * For the 3-business-day delivery rules (LE and CD), a "business day"
 * is any calendar day except Sundays and federal public holidays.
 * Saturdays COUNT as business days for TRID purposes.
 *
 * Phase 84: federal holidays are now generated dynamically per year
 * (lib/compliance/federalHolidays.ts) — no annual maintenance, covers all
 * years, and uses ACTUAL holiday dates (the TRID-correct convention).
 */
function isTRIDBusinessDay(date: Date): boolean {
  if (date.getDay() === 0) return false; // Sundays excluded
  if (isFederalHoliday(date)) return false;
  return true;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Add N TRID business days to a date.
 * A positive N moves forward; negative N moves backward.
 */
export function addTRIDBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  const direction = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);

  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    if (isTRIDBusinessDay(result)) {
      remaining--;
    }
  }

  return result;
}

/**
 * Loan Estimate deadline: must be delivered within 3 business days
 * of receiving the consumer's application (12 CFR 1026.19(e)(1)(iii)).
 */
export function getLoanEstimateDeadline(applicationDate: Date): Date {
  return addTRIDBusinessDays(applicationDate, 3);
}

/**
 * Closing Disclosure deadline: must be received by the consumer
 * no later than 3 business days before consummation (12 CFR 1026.19(f)(1)(ii)).
 * Returns the LATEST date the CD can be sent (closing date minus 3 business days).
 */
export function getClosingDisclosureDeadline(closingDate: Date): Date {
  return addTRIDBusinessDays(closingDate, -3);
}

/**
 * Count TRID business days between two dates (inclusive of start, exclusive of end).
 */
export function countTRIDBusinessDays(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  const end = new Date(to);

  if (cursor >= end) return 0;

  while (cursor < end) {
    if (isTRIDBusinessDay(cursor)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

/**
 * Calculate days remaining until a deadline (positive = days left, negative = overdue).
 */
export function daysUntilDeadline(deadline: Date, today: Date = new Date()): number {
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const deadlineDate = new Date(
    deadline.getFullYear(),
    deadline.getMonth(),
    deadline.getDate()
  );
  const diffMs = deadlineDate.getTime() - todayDate.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

interface TRIDLeadData {
  stage: string;
  application_submitted_at: string | null;
  loan_estimate_sent_at: string | null;
  closing_disclosure_sent_at: string | null;
  closing_date: string | null;
}

/**
 * Get full TRID status for a lead.
 * This is the primary function used throughout the UI.
 */
export function getTRIDStatus(lead: TRIDLeadData, today: Date = new Date()): TRIDStatus {
  const preApplicationStages = ['new_inquiry', 'pre_qual'];
  const postClosingStages = ['closed', 'declined', 'withdrawn'];

  // Stages where TRID doesn't apply yet
  if (preApplicationStages.includes(lead.stage)) {
    return {
      le: 'not_applicable',
      cd: 'not_applicable',
      le_deadline: null,
      cd_deadline: null,
      le_days_remaining: null,
      cd_days_remaining: null,
    };
  }

  // ---- Loan Estimate status ----
  let leStatus: TRIDStatusValue = 'not_applicable';
  let leDeadline: Date | null = null;
  let leDaysRemaining: number | null = null;

  if (lead.application_submitted_at) {
    leDeadline = getLoanEstimateDeadline(new Date(lead.application_submitted_at));
    leDaysRemaining = daysUntilDeadline(leDeadline, today);

    if (lead.loan_estimate_sent_at) {
      // LE sent — check if it was sent on time
      const sentDate = new Date(lead.loan_estimate_sent_at);
      leStatus = sentDate <= leDeadline ? 'ok' : 'overdue';
      leDaysRemaining = null; // not relevant once sent
    } else {
      // LE not yet sent
      if (leDaysRemaining < 0) {
        leStatus = 'overdue';
      } else if (leDaysRemaining === 0) {
        leStatus = 'due_today';
      } else {
        leStatus = 'ok';
      }
    }
  }

  // ---- Closing Disclosure status ----
  let cdStatus: TRIDStatusValue = 'not_applicable';
  let cdDeadline: Date | null = null;
  let cdDaysRemaining: number | null = null;

  // CD only relevant in late-stage loans
  const cdRelevantStages = ['conditional_approval', 'clear_to_close'];
  const cdOrClosedStages = [...cdRelevantStages, ...postClosingStages];

  if (cdOrClosedStages.includes(lead.stage)) {
    if (lead.closing_date) {
      cdDeadline = getClosingDisclosureDeadline(new Date(lead.closing_date));
      cdDaysRemaining = daysUntilDeadline(cdDeadline, today);

      if (lead.closing_disclosure_sent_at) {
        const sentDate = new Date(lead.closing_disclosure_sent_at);
        cdStatus = sentDate <= cdDeadline ? 'ok' : 'overdue';
        cdDaysRemaining = null;
      } else {
        if (lead.stage === 'clear_to_close' && !lead.closing_disclosure_sent_at) {
          // Blocked: cannot be CTC without CD delivered
          cdStatus = 'blocked';
        } else if (cdDaysRemaining < 0) {
          cdStatus = 'overdue';
        } else if (cdDaysRemaining === 0) {
          cdStatus = 'due_today';
        } else {
          cdStatus = 'ok';
        }
      }
    } else if (cdRelevantStages.includes(lead.stage)) {
      // No closing date set — warn
      cdStatus = 'blocked';
    }
  }

  return {
    le: leStatus,
    cd: cdStatus,
    le_deadline: leDeadline,
    cd_deadline: cdDeadline,
    le_days_remaining: leDaysRemaining,
    cd_days_remaining: cdDaysRemaining,
  };
}

/**
 * Validate that a loan can be marked "Clear to Close."
 * Throws a descriptive error if TRID gates are not met.
 */
export function assertClearToCloseEligible(lead: TRIDLeadData): void {
  if (!lead.loan_estimate_sent_at) {
    throw new Error(
      'TRID_GATE: Cannot mark Clear to Close. Loan Estimate has not been sent to the borrower.'
    );
  }

  if (!lead.closing_date) {
    throw new Error(
      'TRID_GATE: Cannot mark Clear to Close. Closing date must be set before issuing Clear to Close.'
    );
  }

  if (!lead.closing_disclosure_sent_at) {
    throw new Error(
      'TRID_GATE: Cannot mark Clear to Close. Closing Disclosure must be delivered to the borrower at least 3 business days before closing.'
    );
  }

  const cdDeadline = getClosingDisclosureDeadline(new Date(lead.closing_date));
  const cdSent = new Date(lead.closing_disclosure_sent_at);

  if (cdSent > cdDeadline) {
    throw new Error(
      `TRID_GATE: Closing Disclosure was sent on ${toDateString(cdSent)}, but the 3-business-day waiting period requires it to have been sent no later than ${toDateString(cdDeadline)}. Closing cannot proceed.`
    );
  }
}

/**
 * Returns a human-readable summary of TRID compliance status.
 */
export function getTRIDSummary(status: TRIDStatus): string {
  const parts: string[] = [];

  const statusLabel = (s: TRIDStatusValue): string => {
    switch (s) {
      case 'ok': return 'OK';
      case 'due_today': return 'DUE TODAY';
      case 'overdue': return 'OVERDUE';
      case 'blocked': return 'BLOCKED';
      case 'not_applicable': return 'N/A';
      default: return s;
    }
  };

  parts.push(`LE: ${statusLabel(status.le)}`);
  if (status.le_days_remaining !== null) {
    parts.push(`(${status.le_days_remaining} day${status.le_days_remaining !== 1 ? 's' : ''} remaining)`);
  }

  parts.push(`CD: ${statusLabel(status.cd)}`);
  if (status.cd_days_remaining !== null) {
    parts.push(`(${status.cd_days_remaining} day${status.cd_days_remaining !== 1 ? 's' : ''} remaining)`);
  }

  return parts.join(' | ');
}

// ── Phase 84 — countdown + color state ─────────────────────────────────────────

export type TRIDColorState = 'green' | 'amber' | 'red' | 'critical';

/**
 * TRID business days remaining until `deadline`, counting days strictly after today
 * up to and including the deadline. Negative when the deadline is in the past.
 * Holiday-aware (uses isTRIDBusinessDay — Saturdays count, Sundays + holidays don't).
 */
export function tridBusinessDaysRemaining(deadline: Date, today: Date = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  if (target.getTime() === start.getTime()) return 0;

  const past = target < start;
  const [from, to] = past ? [target, start] : [start, target];
  let count = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    cursor.setDate(cursor.getDate() + 1);
    if (isTRIDBusinessDay(cursor)) count++;
  }
  return past ? -count : count;
}

/** Color state for a TRID countdown. >5 green · 3–5 amber · 1–2 red · ≤0 critical. */
export function getTRIDColorState(businessDaysRemaining: number): TRIDColorState {
  if (businessDaysRemaining > 5) return 'green';
  if (businessDaysRemaining >= 3) return 'amber';
  if (businessDaysRemaining >= 1) return 'red';
  return 'critical';
}
