/**
 * Phase 97 — recovery SMS copy + resume deep links. PURE (no deps).
 * Deep link targets the public resume route /apply/resume/<token> (the existing
 * /apply/[slug] segment is taken by the Phase 90 per-LO landing). Every message
 * carries the TCPA-required "Reply STOP to unsubscribe".
 */
import type { RecoveryAttempt } from '@/types/abandonRecovery';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';

export function buildDeepLink(token: string, lastSection: string | null): string {
  const base = `${APP_URL}/apply/resume/${token}`;
  return lastSection ? `${base}#section=${lastSection}` : base;
}

export function buildRecoverySMS(params: {
  attempt: RecoveryAttempt;
  first_name: string;
  completion_pct: number;
  lo_name: string;
  deep_link: string;
}): string {
  const { attempt, first_name, completion_pct, lo_name, deep_link } = params;
  const name = (first_name ?? '').trim() || 'there';
  const messages: Record<RecoveryAttempt, string> = {
    1: `Hi ${name}! You started your mortgage application — you're ${completion_pct}% done. Pick up where you left off: ${deep_link} Reply STOP to unsubscribe.`,
    2: `Still thinking? Your application is saved at ${completion_pct}% complete. ${lo_name} is here to help: ${deep_link} Reply STOP to unsubscribe.`,
    3: `Final reminder — your saved application expires in 7 days. Complete it here: ${deep_link} Reply STOP to unsubscribe.`,
  };
  return messages[attempt];
}

/** Hours-since-last-activity threshold for each attempt. */
export const ATTEMPT_THRESHOLD_HOURS: Record<RecoveryAttempt, number> = { 1: 2, 2: 24, 3: 72 };

/** Which attempt (if any) a session is currently eligible for. PURE. */
export function nextEligibleAttempt(
  attemptsSent: number,
  hoursSinceActivity: number,
): RecoveryAttempt | null {
  if (attemptsSent === 0 && hoursSinceActivity >= ATTEMPT_THRESHOLD_HOURS[1]) return 1;
  if (attemptsSent === 1 && hoursSinceActivity >= ATTEMPT_THRESHOLD_HOURS[2]) return 2;
  if (attemptsSent === 2 && hoursSinceActivity >= ATTEMPT_THRESHOLD_HOURS[3]) return 3;
  return null;
}
