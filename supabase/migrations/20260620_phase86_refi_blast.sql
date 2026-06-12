-- Phase 86 — Refi rate-trigger blast (RESPA-compliant outreach audit) + market rate feed.
-- Reuses the existing refi_opportunities table (the "candidates") + /refi-watch surface;
-- the spec's refi_candidates / refi-radar are intentionally NOT duplicated.
-- Adapted: org_id uuid + user_id -> profiles(id) (Clerk auth), get_org_id() RLS.

CREATE TABLE IF NOT EXISTS refi_blast_jobs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triggered_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipient_count           INT NOT NULL,
  transmitted_count         INT NOT NULL DEFAULT 0,
  message_template          TEXT NOT NULL,
  respa_disclaimer_included BOOLEAN NOT NULL DEFAULT TRUE,
  respa_disclaimer_version  TEXT NOT NULL DEFAULT '2024-v1',
  sent_at                   TIMESTAMPTZ,
  status                    TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','sent','failed'))
);

CREATE INDEX IF NOT EXISTS idx_refi_blast_jobs_org ON refi_blast_jobs (org_id, triggered_at DESC);

ALTER TABLE refi_blast_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refi_blast_jobs_org_select" ON refi_blast_jobs
  FOR SELECT USING (org_id = public.get_org_id());
CREATE POLICY "refi_blast_jobs_service_insert" ON refi_blast_jobs
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "refi_blast_jobs_service_update" ON refi_blast_jobs
  FOR UPDATE USING (TRUE);
-- Compliance audit: never deletable.
REVOKE DELETE, TRUNCATE ON refi_blast_jobs FROM PUBLIC, anon, authenticated, service_role;

-- Market rate feed (benchmark by product). Populated nightly from a rate source (gated);
-- seeded here so comparisons are live immediately.
CREATE TABLE IF NOT EXISTS market_rate_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product       TEXT NOT NULL,
  rate          NUMERIC(5,3) NOT NULL,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source        TEXT NOT NULL DEFAULT 'seed',
  UNIQUE (product, snapshot_date)
);

ALTER TABLE market_rate_snapshots ENABLE ROW LEVEL SECURITY;
-- Platform-wide reference data: readable by any authenticated member.
CREATE POLICY "market_rate_snapshots_select" ON market_rate_snapshots
  FOR SELECT USING (TRUE);
CREATE POLICY "market_rate_snapshots_service_insert" ON market_rate_snapshots
  FOR INSERT WITH CHECK (TRUE);

INSERT INTO market_rate_snapshots (product, rate, source)
VALUES ('30yr_fixed', 6.875, 'seed'), ('15yr_fixed', 6.125, 'seed'), ('arm_5_1', 6.500, 'seed')
ON CONFLICT (product, snapshot_date) DO NOTHING;
