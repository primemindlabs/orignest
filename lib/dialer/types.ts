/**
 * Phase 79 — shared dialer types. The dialer is the MLO's primary phone:
 * a call session over a prioritized lead queue, a searchable transcription
 * archive, and a numeric dialpad ("work phone" mode).
 */

/** A lead row as returned by /api/dialer/queue (enriched for priority scoring). */
export interface QueueLead {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  stage: string;
  loan_amount: number | null;
  estimated_value: number | null;
  property_state: string | null;
  last_contacted_at: string | null;
  first_contacted_at: string | null;
  stage_changed_at: string | null;
  closing_date: string | null;
  open_conditions: number;
  created_at: string;
}

/** A queue lead with a computed urgency reason (pinned in the AI priority section). */
export interface PriorityLead extends QueueLead {
  urgencyScore: number;
  urgencyLabel: string;
  urgencyKind: 'rate_lock' | 'no_contact' | 'conditions' | 'stalled';
}

export type CallOutcome =
  | 'connected'
  | 'no_answer'
  | 'voicemail'
  | 'wrong_number'
  | 'callback_scheduled'
  | 'busy';

export interface CallRow {
  id: string;
  direction: 'inbound' | 'outbound';
  phone_from: string;
  phone_to: string;
  status: string;
  duration_seconds: number;
  lead_id: string | null;
  created_at: string;
  leads: { first_name: string; last_name: string } | null;
}

export interface TranscriptRow {
  id: string;
  call_id: string | null;
  transcript_text: string | null;
  ai_summary: string | null;
  created_at: string;
  lead_id: string | null;
  borrower_name: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  outcome: string | null;
}
