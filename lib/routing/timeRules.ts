/**
 * Phase 2.3 — Time-of-day / day-of-week routing rules (server-only)
 *
 * Evaluates routing_time_rules against the current wall-clock time in each rule's
 * timezone. Returns the first matching action so routeLead can hold after-hours
 * leads, hand them to a backup, or send them to the AI pre-qualifier.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export type RoutingAction =
  | 'route_normally'
  | 'route_to_backup'
  | 'hold_for_business_hours'
  | 'send_to_ai_prequalifier';

export interface TimeRuleOutcome {
  action: RoutingAction;
  backupLoId: string | null;
}

// Current weekday (0=Sun) and "HH:MM" in the given IANA timezone.
function nowInTz(timeZone: string): { weekday: number; hm: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const wd: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = wd[get('weekday')] ?? 0;
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return { weekday, hm: `${hour}:${get('minute')}` };
}

// Compares "HH:MM" against rule start/end (which may be "HH:MM:SS"); supports overnight windows.
function withinWindow(hm: string, start: string, end: string): boolean {
  const s = start.slice(0, 5);
  const e = end.slice(0, 5);
  return s <= e ? hm >= s && hm <= e : hm >= s || hm <= e; // overnight wraps midnight
}

export async function evaluateTimeRules(
  orgId: string,
  loId?: string | null,
): Promise<TimeRuleOutcome> {
  const sb = createAdminClient();
  const { data: rules } = await sb
    .from('routing_time_rules')
    .select('lo_id, day_of_week, start_time, end_time, action, backup_lo_id, timezone')
    .eq('org_id', orgId);

  for (const rule of rules ?? []) {
    // A rule scoped to a specific LO only applies when routing to that LO.
    if (rule.lo_id && loId && rule.lo_id !== loId) continue;
    const { weekday, hm } = nowInTz(rule.timezone ?? 'America/New_York');
    if (
      Array.isArray(rule.day_of_week) &&
      rule.day_of_week.includes(weekday) &&
      withinWindow(hm, rule.start_time, rule.end_time)
    ) {
      return { action: rule.action, backupLoId: rule.backup_lo_id ?? null };
    }
  }
  return { action: 'route_normally', backupLoId: null };
}
