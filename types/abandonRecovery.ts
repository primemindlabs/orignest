// Phase 97 — 1003 Application Abandon Recovery types.

export type RecoveryAttempt = 1 | 2 | 3;
export type DeliveryStatus = 'sent' | 'delivered' | 'failed' | 'opted_out' | 'gated';

export interface ApplicationSession {
  id: string;
  org_id: string;
  lead_id: string;
  token: string;
  last_section_completed: string | null;
  completion_pct: number;
  sections_completed: string[];
  sms_consent: boolean;
  borrower_phone: string | null;
  borrower_state: string | null;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
  recovery_attempts_sent: number;
  created_at: string;
}

export interface AbandonRecoveryMessage {
  id: string;
  org_id: string;
  session_id: string;
  lead_id: string;
  recovery_attempt: RecoveryAttempt;
  sms_body: string;
  deep_link: string;
  delivery_status: DeliveryStatus;
  twilio_sid: string | null;
  opened_at: string | null;
  resumed_at: string | null;
  sent_at: string;
  created_at: string;
}

// Dashboard row: session joined with its lead identity + recovery history.
export interface AbandonedSessionDashboard extends ApplicationSession {
  lead: { first_name: string; last_name: string; phone: string | null } | null;
  recovery_messages: AbandonRecoveryMessage[];
}
