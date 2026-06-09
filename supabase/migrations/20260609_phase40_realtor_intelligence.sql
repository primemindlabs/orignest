-- ============================================================
-- Ashley IQ — Phase 40: Realtor Intelligence Engine
-- 2026-06-09 — Real schema: tenants->organizations, users->profiles.
-- New `realtors` table (production metrics + partnership scoring) — distinct
-- from referral_partners (basic partner CRM) and portal_realtors (portal access).
-- ============================================================

CREATE TABLE IF NOT EXISTS realtors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name text NOT NULL, last_name text NOT NULL, email text, phone text,
  license_number text, nmls_state text,
  brokerage_name text, brokerage_address text, brokerage_phone text, office_mls_id text,
  mls_agent_id text, attom_agent_id text, last_attom_sync timestamptz,
  transactions_12m integer NOT NULL DEFAULT 0, volume_12m bigint NOT NULL DEFAULT 0,
  avg_price_12m integer NOT NULL DEFAULT 0, buyer_side_pct numeric(4,1), seller_side_pct numeric(4,1),
  primary_zip_codes text[], primary_city text,
  partnership_score integer NOT NULL DEFAULT 0,
  partnership_tier text NOT NULL DEFAULT 'prospect' CHECK (partnership_tier IN ('prospect','developing','active_partner','top_partner','dormant')),
  deals_referred_12m integer NOT NULL DEFAULT 0, last_referral_at timestamptz, last_contact_at timestamptz,
  relationship_notes text, is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, mls_agent_id)
);
CREATE INDEX IF NOT EXISTS idx_realtors_org_score ON realtors(org_id, partnership_score DESC);
CREATE INDEX IF NOT EXISTS idx_realtors_tier ON realtors(org_id, partnership_tier);
ALTER TABLE realtors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "realtors_tenant" ON realtors;
CREATE POLICY "realtors_tenant" ON realtors FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS realtor_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  realtor_id uuid NOT NULL REFERENCES realtors(id) ON DELETE CASCADE,
  lo_id uuid REFERENCES profiles(id),
  touch_type text NOT NULL CHECK (touch_type IN ('email','sms','call','in_person','co_marketing_send','referral_received','note')),
  subject text, body text, outcome text,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rt_realtor ON realtor_touches(realtor_id, created_at DESC);
ALTER TABLE realtor_touches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rt_select" ON realtor_touches;
CREATE POLICY "rt_select" ON realtor_touches FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "rt_insert" ON realtor_touches;
CREATE POLICY "rt_insert" ON realtor_touches FOR INSERT WITH CHECK (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON realtor_touches FROM PUBLIC, authenticated, service_role, anon;

CREATE TABLE IF NOT EXISTS realtor_cobrand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  realtor_id uuid NOT NULL REFERENCES realtors(id) ON DELETE CASCADE,
  lo_id uuid REFERENCES profiles(id),
  asset_type text NOT NULL CHECK (asset_type IN ('market_update','rate_flyer','open_house_flyer','buyer_guide','social_graphic')),
  title text NOT NULL, file_url text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rca_realtor ON realtor_cobrand_assets(realtor_id, created_at DESC);
ALTER TABLE realtor_cobrand_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rca_all" ON realtor_cobrand_assets;
CREATE POLICY "rca_all" ON realtor_cobrand_assets FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
