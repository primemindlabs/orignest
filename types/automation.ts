// Phase 107 — milestone automation types.
export type AutomationActionType =
  | 'sms_borrower'
  | 'sms_realtor'
  | 'email_borrower'
  | 'email_realtor'
  | 'internal_note';

export type ApprovalStatus = 'pending' | 'approved' | 'auto_sent' | 'skipped' | 'failed';

export interface MilestoneAutomationRule {
  id: string;
  rule_name: string;
  trigger_stage: string;
  action_type: AutomationActionType;
  message_template: string;
  active: boolean;
  requires_approval: boolean;
  auto_send_email: boolean;
  delay_minutes: number;
  created_at: string;
  updated_at: string;
}

// Real leads.stage values (vs the spec's lead/funded/post_close).
export const FUNNEL_STAGES = [
  { value: 'new_inquiry', label: 'New Inquiry' },
  { value: 'pre_qual', label: 'Pre-Qual' },
  { value: 'application', label: 'Application' },
  { value: 'processing', label: 'Processing' },
  { value: 'underwriting', label: 'Underwriting' },
  { value: 'conditional_approval', label: 'Conditional Approval' },
  { value: 'clear_to_close', label: 'Clear to Close' },
  { value: 'closed', label: 'Closed / Funded' },
] as const;

export const STAGE_LABELS: Record<string, string> = Object.fromEntries(
  FUNNEL_STAGES.map((s) => [s.value, s.label])
);
