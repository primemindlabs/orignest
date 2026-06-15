// Phase 134 — NMLS soft-lock gate for outbound borrower communication.
//
// A loan officer may send borrower-facing SMS/email only if they either (a) have an
// NMLS number on file, or (b) have self-attested an exemption (registered MLO under a
// depository's NMLS, or commercial-only originator). This is a SOFT lock: the LO can
// clear it themselves from /settings/profile in seconds — it never blocks anyone who
// is actually licensed, only prompts the unconfigured.
//
// Internal/transactional system mail (billing, TRID alerts to staff) does NOT route
// through this gate — only LO→borrower outbound does.
import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient<any, any, any>;

export type CommsExemptReason = 'depository_registered' | 'commercial_only' | 'other';

export interface CommsGateStatus {
  allowed: boolean;
  hasNmls: boolean;
  exempt: boolean;
  exemptReason: CommsExemptReason | null;
  /** Human-readable reason when blocked; null when allowed. */
  reason: string | null;
}

/** Pure evaluation from already-loaded profile fields — no DB round-trip. */
export function evaluateCommsGate(p: {
  nmls_id?: string | null;
  comms_exempt?: boolean | null;
  comms_exempt_reason?: string | null;
}): CommsGateStatus {
  const hasNmls = !!(p.nmls_id && String(p.nmls_id).trim());
  const exempt = !!p.comms_exempt;
  const allowed = hasNmls || exempt;
  return {
    allowed,
    hasNmls,
    exempt,
    exemptReason: (p.comms_exempt_reason as CommsExemptReason | null) ?? null,
    reason: allowed
      ? null
      : 'Add your NMLS number, or mark yourself NMLS-exempt, before sending borrower communications.',
  };
}

/** Resolve the gate for the signed-in LO by Clerk user id within an org. */
export async function getCommsGateStatus(
  sb: Admin,
  args: { clerkUserId: string; orgId: string }
): Promise<CommsGateStatus> {
  const { data } = await sb
    .from('profiles')
    .select('nmls_id, comms_exempt, comms_exempt_reason')
    .eq('clerk_user_id', args.clerkUserId)
    .eq('org_id', args.orgId)
    .maybeSingle();
  return evaluateCommsGate(data ?? {});
}

/** Standard 403 body for a blocked send, mirroring the billing feature-gate shape. */
export function commsLockedResponse(status: CommsGateStatus) {
  return {
    error: status.reason ?? 'Communication is locked until your sender identity is configured.',
    code: 'COMMS_LOCKED',
    settings_url: '/settings/profile',
  };
}
