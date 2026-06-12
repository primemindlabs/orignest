// Phase 103 — Post-Close Equity Loop types. Built on borrower_relationships (the
// monitor) + post_close_outreach (the review queue). Org-scoped, Clerk auth.

export type TriggerType = 'rate_drop' | 'equity_gain' | 'anniversary' | 'manual';
export type MonitoringStatus = 'active' | 'paused' | 'opted_out';

/** A funded borrower being monitored (row of borrower_relationships). */
export interface PostCloseMonitor {
  id: string;
  full_name: string;
  phone: string | null;
  last_close_date: string | null;
  original_rate: number | null;
  current_market_rate: number | null;
  rate_delta: number | null;
  last_known_avm: number | null;
  current_loan_balance: number | null;
  estimated_equity: number | null;
  refi_alert_threshold: number;
  monitoring_status: MonitoringStatus;
  lead_id: string | null; // first lead, for "View Loan"
}

/** A drafted outreach awaiting LO review (row of post_close_outreach). */
export interface PostCloseOutreach {
  id: string;
  relationship_id: string;
  lead_id: string | null;
  trigger_type: TriggerType;
  trigger_details: Record<string, any>;
  outreach_message: string;
  channel: 'sms' | 'email';
  requires_review: boolean;
  status: 'queued' | 'sent' | 'skipped';
  sent_at: string | null;
  created_at: string;
}

export interface PostCloseMonitorWithTriggers extends PostCloseMonitor {
  pending_triggers: PostCloseOutreach[];
}
