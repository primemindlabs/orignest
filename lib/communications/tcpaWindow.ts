/**
 * Phase 66 — TCPA calling-window guard. PURE.
 * No outbound SMS/calls before 8am or after 9pm in the RECIPIENT's local time.
 * Maps the borrower's state to its primary IANA timezone (multi-tz states use the
 * most-populous zone), computes the local hour, and returns allow/block + reason.
 * Enforce this at the send-route layer — never bypass via UI.
 */
const STATE_TZ: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago', CA: 'America/Los_Angeles',
  CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York', FL: 'America/New_York',
  GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago', KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
  MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles', NH: 'America/New_York',
  NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago',
  OH: 'America/New_York', OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver',
};

const START_HOUR = 8;  // 8:00am
const END_HOUR = 21;   // 9:00pm

export interface TcpaWindowResult { allowed: boolean; timezone: string | null; local_hour: number | null; local_time: string | null; reason: string | null }

export function timezoneForState(state: string | null | undefined): string | null {
  return STATE_TZ[(state ?? '').trim().toUpperCase()] ?? null;
}

export function checkCallingWindow(state: string | null | undefined, now: Date = new Date()): TcpaWindowResult {
  const tz = timezoneForState(state);
  if (!tz) return { allowed: false, timezone: null, local_hour: null, local_time: null, reason: 'No borrower state on file — cannot verify the TCPA calling window. Confirm state before sending.' };

  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(now);
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value ?? 'AM';
  let hour = Number(hourStr) % 12;
  if (dayPeriod.toUpperCase() === 'PM') hour += 12;
  const localTime = parts.filter((p) => ['hour', 'literal', 'minute', 'dayPeriod'].includes(p.type)).map((p) => p.value).join('');

  const allowed = hour >= START_HOUR && hour < END_HOUR;
  return { allowed, timezone: tz, local_hour: hour, local_time: localTime, reason: allowed ? null : `Outside the TCPA calling window — it's ${localTime} for the borrower (allowed 8:00 AM–9:00 PM local).` };
}

export class TcpaWindowError extends Error {
  constructor(public result: TcpaWindowResult) { super(result.reason ?? 'TCPA window'); this.name = 'TcpaWindowError'; }
}

/** Strip SSN / account-number patterns from message text before storage. PURE. */
export function stripPII(text: string): string {
  return (text ?? '').replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN REDACTED]').replace(/\b\d{8,17}\b/g, '[ACCT REDACTED]');
}
