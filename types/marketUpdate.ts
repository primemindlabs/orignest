// Phase 100 — Realtor weekly market update (email blast) types.

export interface RealtorMarketUpdate {
  id: string;
  org_id: string;
  lo_id: string;
  week_of: string;
  rate_30yr_conv: number | null;
  rate_15yr_conv: number | null;
  rate_30yr_fha: number | null;
  rate_30yr_va: number | null;
  market_summary: string;
  talking_points: string[];
  source_disclosure: string;
  status: 'draft' | 'approved' | 'sent' | 'cancelled';
  approved_at: string | null;
  sent_at: string | null;
  total_recipients: number | null;
  generated_at: string;
  created_at: string;
}

export interface RealtorMarketUpdateSettings {
  id: string;
  org_id: string;
  lo_id: string;
  auto_send_enabled: boolean;
  send_day: string;
  send_hour_utc: number;
  rate_source_note: string | null;
  email_subject_prefix: string;
  created_at: string;
}
