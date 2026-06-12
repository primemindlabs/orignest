-- Phase 83 — Pipeline close-probability scores + 4-week capacity snapshots.
-- Adapted: user_id -> profiles(id), org_id uuid scoping, get_org_id() RLS, service writes.

CREATE TABLE IF NOT EXISTS loan_probability_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  score           INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  confidence      TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  driving_factors JSONB NOT NULL DEFAULT '[]',
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id)
);

CREATE INDEX IF NOT EXISTS idx_loan_probability_scores_org ON loan_probability_scores (org_id);

CREATE TABLE IF NOT EXISTS pipeline_capacity_snapshots (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start              DATE NOT NULL,
  weighted_pipeline_value NUMERIC(14,2) NOT NULL,
  loan_count              INT NOT NULL,
  snapshot_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (user_id, week_start, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_user ON pipeline_capacity_snapshots (user_id, week_start);

ALTER TABLE loan_probability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_capacity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loan_probability_scores_org_select" ON loan_probability_scores
  FOR SELECT USING (org_id = public.get_org_id());
CREATE POLICY "loan_probability_scores_service_insert" ON loan_probability_scores
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "loan_probability_scores_service_update" ON loan_probability_scores
  FOR UPDATE USING (TRUE);

CREATE POLICY "pipeline_capacity_snapshots_org_select" ON pipeline_capacity_snapshots
  FOR SELECT USING (org_id = public.get_org_id());
CREATE POLICY "pipeline_capacity_snapshots_service_insert" ON pipeline_capacity_snapshots
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "pipeline_capacity_snapshots_service_update" ON pipeline_capacity_snapshots
  FOR UPDATE USING (TRUE);
