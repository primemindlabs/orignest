// Phase 108 — Branch Manager Dashboard types. Live-computed (no snapshots).
// Adapted: names from profiles.first_name/last_name (no full_name); nmls_id (not
// nmls_number); TRID from trid_events (not a trid_alerts table).

export interface LOMetrics {
  leads_active: number;
  loans_in_pipeline: number;
  loans_funded_30d: number;
  pipeline_value: number;
  trid_alerts_open: number;
  avg_days_to_close: number | null;
  conversion_rate: number | null; // 0..1
}

export interface LOProfileSummary {
  lo_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  nmls_id: string | null;
  metrics: LOMetrics;
}

export interface BranchAggregate {
  total_active_leads: number;
  total_pipeline_value: number;
  total_funded_30d: number;
  total_trid_alerts: number;
  lo_count: number;
}

export interface TRIDAlertItem {
  id: string;
  lead_id: string;
  lo_name: string;
  borrower_last_name: string;
  alert_type: string;
  due_date: string | null;
  days_overdue: number;
}

export interface ProductionTrendPoint {
  week: string; // ISO date of week start (Monday)
  funded: number;
  pipeline_value: number; // closed $ volume that week
}

export interface BranchDashboardData {
  aggregate: BranchAggregate;
  team: LOProfileSummary[];
  alerts: TRIDAlertItem[];
  trend: ProductionTrendPoint[];
}
