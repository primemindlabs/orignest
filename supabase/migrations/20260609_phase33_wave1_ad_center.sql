-- ============================================================
-- Ashley IQ — Phase 33 · Wave 1: Ad Creative Builder + Co-Marketing
-- 2026-06-09
--
-- Compliance/audit layer on top of the existing Ad Center (/ads). Translated to
-- real schema: tenant_id -> org_id; auth.jwt() RLS -> get_org_id(); realtors ->
-- referral_partners; users -> Clerk user id (text).
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_creatives (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      text NOT NULL,                 -- Clerk user id
  ad_type         text NOT NULL CHECK (ad_type IN ('purchase','refinance','fha','va','heloc','coop')),
  platform        text NOT NULL CHECK (platform IN ('meta','google','both')),
  headline        text NOT NULL,
  primary_text    text,
  description     text,
  cta_type        text,
  compliance_status text NOT NULL DEFAULT 'pending' CHECK (compliance_status IN ('pending','approved','rejected')),
  nmls_number     text,                          -- required to export (enforced at API)
  equal_housing_included boolean NOT NULL DEFAULT true,
  apr_disclosure  text,
  export_count    integer NOT NULL DEFAULT 0,
  is_archived     boolean NOT NULL DEFAULT false,
  coop_realtor_id uuid REFERENCES referral_partners(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_creatives_org ON ad_creatives(org_id, created_at DESC);
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_creatives_select" ON ad_creatives;
CREATE POLICY "ad_creatives_select" ON ad_creatives FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ad_creatives_write" ON ad_creatives;
CREATE POLICY "ad_creatives_write" ON ad_creatives FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- INSERT-only permanent compliance audit trail.
CREATE TABLE IF NOT EXISTS creative_compliance_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id uuid NOT NULL REFERENCES ad_creatives(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  model_used  text NOT NULL DEFAULT 'claude-sonnet-4-5',
  passed      boolean NOT NULL,
  issues      jsonb NOT NULL DEFAULT '[]',
  raw_response text
);
CREATE INDEX IF NOT EXISTS idx_ccr_creative ON creative_compliance_reviews(creative_id, reviewed_at DESC);
ALTER TABLE creative_compliance_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ccr_select" ON creative_compliance_reviews;
CREATE POLICY "ccr_select" ON creative_compliance_reviews FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ccr_insert" ON creative_compliance_reviews;
CREATE POLICY "ccr_insert" ON creative_compliance_reviews FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON creative_compliance_reviews FROM PUBLIC, authenticated, service_role, anon;

-- 33.3 Co-marketing (RESPA-gated).
CREATE TABLE IF NOT EXISTS coop_ad_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           text NOT NULL,                 -- Clerk user id
  realtor_id      uuid NOT NULL REFERENCES referral_partners(id) ON DELETE CASCADE,
  creative_id     uuid REFERENCES ad_creatives(id) ON DELETE SET NULL,
  lo_budget_pct   integer NOT NULL CHECK (lo_budget_pct BETWEEN 0 AND 100),
  realtor_budget_pct integer NOT NULL CHECK (realtor_budget_pct BETWEEN 0 AND 100),
  total_budget_cents integer,
  respa_acknowledgment_at timestamptz,
  respa_acknowledged_by text,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_coop_budget_sum CHECK (lo_budget_pct + realtor_budget_pct = 100)
);
CREATE INDEX IF NOT EXISTS idx_coop_org ON coop_ad_campaigns(org_id, created_at DESC);
ALTER TABLE coop_ad_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coop_select" ON coop_ad_campaigns;
CREATE POLICY "coop_select" ON coop_ad_campaigns FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "coop_write" ON coop_ad_campaigns;
CREATE POLICY "coop_write" ON coop_ad_campaigns FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- INSERT-only billing records.
CREATE TABLE IF NOT EXISTS coop_ad_billing (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coop_campaign_id uuid NOT NULL REFERENCES coop_ad_campaigns(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  lo_amount_cents integer NOT NULL,
  realtor_amount_cents integer NOT NULL,
  total_spend_cents integer NOT NULL,
  recorded_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coop_billing ON coop_ad_billing(coop_campaign_id, recorded_at DESC);
ALTER TABLE coop_ad_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coop_billing_select" ON coop_ad_billing;
CREATE POLICY "coop_billing_select" ON coop_ad_billing FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "coop_billing_insert" ON coop_ad_billing;
CREATE POLICY "coop_billing_insert" ON coop_ad_billing FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON coop_ad_billing FROM PUBLIC, authenticated, service_role, anon;
