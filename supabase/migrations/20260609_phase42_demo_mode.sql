-- ============================================================
-- Ashley IQ — Phase 42.4: Demo Mode
-- 2026-06-09 — sample leads flagged is_demo: bulk-removable, excluded from
-- billing/usage metrics.
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_leads_demo ON leads(org_id) WHERE is_demo = true;
