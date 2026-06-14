/**
 * Phase 128 — Ashley Autopilot™ shared types.
 * Adapted to the real stack: entity_id is a leads(id) for borrowers, realtors(id)
 * for realtors; loan_id is a leads(id). lo_id is profiles(id).
 */

export type AutopilotActionType =
  | 'send_sms'
  | 'send_email'
  | 'internal_alert'
  | 'trigger_workflow'
  | 'schedule_call_reminder';

export type AutopilotEntityType =
  | 'borrower'
  | 'realtor'
  | 'lender_ae'
  | 'referral_partner';

export type AutopilotStatus =
  | 'pending'
  | 'approved'
  | 'executing'
  | 'executed'
  | 'rejected'
  | 'undone'
  | 'expired';

export type AutopilotSignalType =
  | 'condition_aging'
  | 'rate_lock_expiring'
  | 'heat_score_drop'
  | 'birthday'
  | 'fallout_risk'
  | 'post_close_equity'
  | 'realtor_dormant'
  | 'new_arrive_lead'
  | 'goldmine';

/** A recommended action before it's inserted (no id / lo_id / org_id yet). */
export interface DraftAction {
  action_type: AutopilotActionType;
  signal_type: AutopilotSignalType;
  signal_reason: string;
  recommended_content?: string | null;
  recommended_subject?: string | null;
  entity_type: AutopilotEntityType;
  entity_id: string;
  entity_name: string;
  loan_id?: string | null;
  priority: number;
}

/** A persisted row from autopilot_actions. */
export interface AutopilotAction extends DraftAction {
  id: string;
  org_id: string;
  lo_id: string;
  status: AutopilotStatus;
  approved_at: string | null;
  approved_by: string | null;
  executed_at: string | null;
  undo_deadline: string | null;
  undo_used_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  failure_reason: string | null;
  generated_at: string;
  generated_date: string;
  created_at: string;
}

/** Lightweight LO identity passed into the generator for draft signatures. */
export interface LoSignatureContext {
  loId: string;
  firstName: string | null;
  lastName: string | null;
  nmls: string | null;
  company: string | null;
}

export const UNDO_WINDOW_MS = 5 * 60 * 1000;

/** Map a signal type to the TCPA SMS category used by canSendSMS(). */
export function smsCategoryForSignal(
  signal: AutopilotSignalType,
): 'loan_updates' | 'reminders' | 'marketing' {
  switch (signal) {
    case 'condition_aging':
    case 'rate_lock_expiring':
      return 'loan_updates';
    case 'birthday':
    case 'post_close_equity':
    case 'goldmine':
      return 'marketing';
    default:
      return 'reminders';
  }
}
