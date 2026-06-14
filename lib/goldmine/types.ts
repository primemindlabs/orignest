/**
 * Phase 131 — Database Goldmine™ shared types.
 * Adapted to the real stack: lo_id→profiles(id), contact_id/loan_id→leads(id).
 * Equity comes from borrower_relationships (Phase 103/28), not DeedMine (deferred).
 */

export type GoldmineSignalType =
  | 'pre_approval_expired'
  | 'rate_improvement'
  | 'equity_milestone'
  | 'loan_anniversary'
  | 'long_inactive'
  | 'denial_retry';

export type GoldmineStatus = 'surfaced' | 'outreached' | 'responded' | 'converted' | 'dismissed';

/** A computed opportunity before persistence (no id/lo_id/org_id yet). */
export interface GoldmineCandidate {
  contact_id: string;
  contact_name: string;
  loan_id: string | null;
  signal_type: GoldmineSignalType;
  signal_headline: string;
  signal_detail: Record<string, unknown>;
  priority_score: number;
  estimated_loan_amount: number | null;
  estimated_comp_dollars: number | null;
  draft_sms: string | null;
  draft_email_subject: string | null;
  draft_email_body: string | null;
}

export interface GoldmineOpportunity extends GoldmineCandidate {
  id: string;
  org_id: string;
  lo_id: string;
  status: GoldmineStatus;
  dismissed_until: string | null;
  surfaced_at: string;
  last_updated: string;
  created_at: string;
}

export const SIGNAL_LABELS: Record<GoldmineSignalType, string> = {
  pre_approval_expired: 'Pre-Approval',
  rate_improvement: 'Rate Refi',
  equity_milestone: 'Equity',
  loan_anniversary: 'Anniversary',
  long_inactive: 'Inactive',
  denial_retry: 'Denial Retry',
};
