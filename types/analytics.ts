// Phase 98 — Referral Source ROI Analytics types.

export type ReferralSourceType =
  | 'realtor' | 'zillow' | 'meta_ads' | 'google_ads' | 'referral' | 'organic' | 'other';
export type CostPeriod = 'monthly' | 'per_lead' | 'one_time';

export interface ReferralSourceCost {
  id: string;
  org_id: string;
  lo_id: string;
  source_type: ReferralSourceType;
  source_detail: string | null;
  cost_amount: number;
  cost_period: CostPeriod;
  active_from: string;
  active_to: string | null;
  created_at: string;
}

export interface ReferralROIRow {
  source_type: string; // ReferralSourceType, or 'untagged' (display-only)
  source_detail: string | null;
  leads_count: number;
  closed_count: number;
  close_rate: number | null;
  total_cost: number;
  total_gross_comp: number;
  cost_per_closed: number | null;
  roi_multiple: number | null;
}

export interface ReferralROIResponse {
  data: ReferralROIRow[];
  period_days: number;
  period_start: string;
  period_end: string;
}
