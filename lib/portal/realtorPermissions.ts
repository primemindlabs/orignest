/**
 * Phase 28.4 — Realtor portal permissions.
 *
 * Permission tiers gate WHICH milestones a realtor sees. The blocked-field list
 * is an absolute wall: financial data is NEVER returned to a realtor token-gated
 * route regardless of tier, enforced at the API layer (not just the UI).
 */
export type PermissionTier = 'status_only' | 'transaction_partner' | 'full_partner';

export interface RealtorPermissions {
  see_stage: boolean;
  see_milestones: boolean;
  see_closing_date: boolean;
  see_appraisal_status: boolean;
  see_conditions_count: boolean;
  see_rate_lock_expiry: boolean;
  see_ctc_status: boolean;
  message_lo: boolean;
}

export const PERMISSION_TIER_DEFAULTS: Record<PermissionTier, RealtorPermissions> = {
  status_only: {
    see_stage: true, see_milestones: true, see_closing_date: true,
    see_appraisal_status: false, see_conditions_count: false,
    see_rate_lock_expiry: false, see_ctc_status: false, message_lo: false,
  },
  transaction_partner: {
    see_stage: true, see_milestones: true, see_closing_date: true,
    see_appraisal_status: true, see_conditions_count: true,
    see_rate_lock_expiry: false, see_ctc_status: true, message_lo: true,
  },
  full_partner: {
    see_stage: true, see_milestones: true, see_closing_date: true,
    see_appraisal_status: true, see_conditions_count: true,
    see_rate_lock_expiry: true, see_ctc_status: true, message_lo: true,
  },
};

// Hard wall — never returned to a realtor route, regardless of permissions.
export const REALTOR_BLOCKED_FIELDS = [
  'credit_score', 'dti', 'income', 'assets', 'rate', 'apr',
  'points', 'pricing', 'adverse_action', 'declinations',
];

/** Strip any blocked financial field from an object before it reaches a realtor. */
export function scrubFinancialFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REALTOR_BLOCKED_FIELDS.some((b) => k.toLowerCase().includes(b))) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}
