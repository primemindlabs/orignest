// Phase 129 — shared UI type for a loan_intelligence_scores row.
import type { FalloutFlag } from '@/lib/intelligence/computeFileIntelligence';

export type { FalloutFlag };

export interface LoanIntelligenceScores {
  loan_id: string;
  org_id: string;
  lo_id: string;
  file_health_score: number;
  close_probability: number;
  uw_readiness_score: number;
  predicted_close_date: string | null;
  predicted_close_confidence: 'high' | 'medium' | 'low' | null;
  fallout_flags: FalloutFlag[] | null;
  health_drivers: { positive: string[]; negative: string[] } | null;
  uw_drivers: { ready: string[]; missing: string[] } | null;
  computed_at: string;
}
