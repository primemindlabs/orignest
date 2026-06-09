/**
 * Phase 33.4 — TCPA compliance guard (server-only). Enforced before any dial:
 *  1. auto_dial_consent on record (communication_consents, not revoked)
 *  2. lead not DNC-flagged
 *  3. current time within 8:00 AM – 9:00 PM in the lead's local time zone
 *
 * Real schema: org_id; communication_consents (party_type='borrower'); leads
 * has property_state (used for the time-zone lookup) + dnc_flagged.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const DO_NOT_CALL_START_HOUR = 8; // 8:00 AM local
const DO_NOT_CALL_END_HOUR = 21; // 9:00 PM local

export interface TcpaCheckResult {
  allowed: boolean;
  reason?: string;
  next_allowed_at?: string;
}

// Full 50-state (+DC) state→IANA time zone map. States spanning zones use the
// dominant/most-populous zone.
const STATE_TIMEZONE: Record<string, string> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago',
  CA: 'America/Los_Angeles', CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York',
  DC: 'America/New_York', FL: 'America/New_York', GA: 'America/New_York', HI: 'Pacific/Honolulu',
  ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis', IA: 'America/Chicago',
  KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
  MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago',
  MS: 'America/Chicago', MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago',
  NV: 'America/Los_Angeles', NH: 'America/New_York', NJ: 'America/New_York', NM: 'America/Denver',
  NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago', OH: 'America/New_York',
  OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago',
  UT: 'America/Denver', VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles',
  WV: 'America/New_York', WI: 'America/Chicago', WY: 'America/Denver',
};

function hourInZone(tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
  return parseInt(fmt.format(new Date()), 10);
}

export async function checkTcpaCompliance(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  leadId: string,
  leadState: string | null | undefined
): Promise<TcpaCheckResult> {
  // 1. auto-dial consent
  const { data: consent } = await sb
    .from('communication_consents')
    .select('auto_dial_consent, revoked_at')
    .eq('org_id', orgId)
    .eq('lead_id', leadId)
    .eq('party_type', 'borrower')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!consent?.auto_dial_consent || consent?.revoked_at) {
    return { allowed: false, reason: 'No auto-dial consent on record. Manual calls are permitted; the auto-dialer requires written consent.' };
  }

  // 2. DNC flag
  const { data: lead } = await sb.from('leads').select('dnc_flagged').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (lead?.dnc_flagged) {
    return { allowed: false, reason: 'Lead is on the Do Not Call list.' };
  }

  // 3. time window in the lead's local time zone
  const tz = STATE_TIMEZONE[(leadState ?? '').toUpperCase()] ?? 'America/New_York';
  const hour = hourInZone(tz);
  if (hour < DO_NOT_CALL_START_HOUR || hour >= DO_NOT_CALL_END_HOUR) {
    return {
      allowed: false,
      reason: `Outside calling hours. It is ${hour}:00 in the lead's time zone (${tz}). TCPA calling hours: 8:00 AM – 9:00 PM local time.`,
    };
  }

  return { allowed: true };
}
