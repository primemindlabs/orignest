-- Phase 90 — per-LO shareable borrower application slug.
-- Populated on-demand by ensureApplicationSlug() (collision-safe) when an LO first
-- views their application link, so no risky bulk backfill at migration time.
-- Already applied to prod (project dhnxiijduycmzfjmohyp) via MCP.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS application_slug TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_application_slug ON profiles(application_slug);
COMMENT ON COLUMN profiles.application_slug IS 'Per-LO public borrower application landing slug (/apply/[slug]) — Phase 90';
