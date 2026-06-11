/**
 * Phase 79 — pure urgency scoring for the dialer queue. No DB, no I/O; takes an
 * already-loaded queue and returns the leads worth calling first, with a plain
 * reason the MLO can act on.
 *
 * Priority order (spec §AI Priority): rate lock ≤3d  >  no contact ≥14d
 *   >  open conditions ≥3  >  stalled ≥5d with no stage change.
 *
 * Real-schema note: leads has no rate-lock column, so the "rate lock" signal is
 * approximated by an imminent closing_date (≤3 days) — the loan is about to fund
 * and any lock would be expiring with it. When a true rate_lock column lands,
 * swap closeDays for it here only.
 */
import type { QueueLead, PriorityLead } from './types';

const DAY_MS = 86_400_000;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / DAY_MS);
}

/** Score one lead. Returns null when nothing is urgent. Higher score = call sooner. */
export function scoreLead(lead: QueueLead): PriorityLead | null {
  const closeDays = daysUntil(lead.closing_date);
  const sinceContact = daysSince(lead.last_contacted_at ?? lead.first_contacted_at);
  const sinceStage = daysSince(lead.stage_changed_at);

  // 1. Closing imminent (proxy for rate-lock expiring) — highest urgency.
  if (closeDays != null && closeDays >= 0 && closeDays <= 3) {
    return {
      ...lead,
      urgencyScore: 400 - closeDays,
      urgencyLabel: closeDays === 0 ? 'Closes today' : `Closes in ${closeDays}d`,
      urgencyKind: 'rate_lock',
    };
  }

  // 2. No contact in ≥14 days.
  if (sinceContact != null && sinceContact >= 14) {
    return {
      ...lead,
      urgencyScore: 300 + Math.min(sinceContact, 90),
      urgencyLabel: `No contact ${sinceContact}d`,
      urgencyKind: 'no_contact',
    };
  }

  // 3. Three or more outstanding conditions.
  if (lead.open_conditions >= 3) {
    return {
      ...lead,
      urgencyScore: 200 + lead.open_conditions,
      urgencyLabel: `${lead.open_conditions} open conditions`,
      urgencyKind: 'conditions',
    };
  }

  // 4. Stalled ≥5 days with no stage change.
  if (sinceStage != null && sinceStage >= 5) {
    return {
      ...lead,
      urgencyScore: 100 + Math.min(sinceStage, 60),
      urgencyLabel: `Stalled ${sinceStage}d`,
      urgencyKind: 'stalled',
    };
  }

  return null;
}

/** Split a queue into pinned priority leads (sorted, most urgent first) and the rest. */
export function partitionQueue(leads: QueueLead[]): {
  priority: PriorityLead[];
  rest: QueueLead[];
} {
  const priority: PriorityLead[] = [];
  const priorityIds = new Set<string>();

  for (const lead of leads) {
    const scored = scoreLead(lead);
    if (scored) {
      priority.push(scored);
      priorityIds.add(lead.id);
    }
  }

  priority.sort((a, b) => b.urgencyScore - a.urgencyScore);
  const rest = leads.filter((l) => !priorityIds.has(l.id));
  return { priority, rest };
}

/** Tailwind-friendly inline style for an urgency badge by kind. */
export const URGENCY_STYLE: Record<PriorityLead['urgencyKind'], { bg: string; fg: string }> = {
  rate_lock: { bg: '#fdf0ea', fg: '#C4724A' },
  no_contact: { bg: '#fdf0ea', fg: '#C4724A' },
  conditions: { bg: '#f5f5f5', fg: '#6B7B8D' },
  stalled: { bg: '#fdf8ee', fg: '#8a6310' },
};
