-- ============================================================
-- Ashley IQ — Phase 35 · Wave 1: Billing feature-gating
-- 2026-06-09
--
-- Billing infra already exists (organizations.subscription_plan/status/
-- stripe_*/trial_ends_at + /api/stripe/{checkout,portal,webhook} + lib/stripe/
-- plans.ts with starter/growth/team). Phase 35 adds the FEATURE-GATING layer +
-- audit tables. Real schema: tenants -> organizations; auth.jwt() -> get_org_id().
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS plan_seat_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS billing_name text;

-- Immutable billing audit (platform-only — orgs cannot read it).
CREATE TABLE IF NOT EXISTS billing_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id) ON DELETE SET NULL,
  stripe_event_id text UNIQUE NOT NULL,
  event_type      text NOT NULL,
  payload         jsonb NOT NULL DEFAULT '{}',
  processed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_events_org ON billing_events(org_id, processed_at DESC);
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
-- INSERT-only; no SELECT policy → only the service role (which bypasses RLS) reads it.
DROP POLICY IF EXISTS "billing_events_insert" ON billing_events;
CREATE POLICY "billing_events_insert" ON billing_events FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON billing_events FROM PUBLIC, authenticated, service_role, anon;

-- Metered feature usage (per org per period).
CREATE TABLE IF NOT EXISTS feature_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  feature         text NOT NULL,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  usage_count     integer NOT NULL DEFAULT 0,
  limit_count     integer,
  UNIQUE(org_id, feature, period_start)
);
CREATE INDEX IF NOT EXISTS idx_feature_usage_org ON feature_usage(org_id, feature);
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feature_usage_tenant" ON feature_usage;
CREATE POLICY "feature_usage_tenant" ON feature_usage FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
