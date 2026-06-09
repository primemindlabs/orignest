-- ============================================================
-- Ashley IQ — Phase 48: Realtor Discovery Engine (beats Model Match)
-- 2026-06-09 — Real schema: tenants->organizations, users->profiles.
-- Builds on Phase 40 realtors/realtor_touches.
-- ============================================================

CREATE TABLE IF NOT EXISTS realtor_market_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  attom_agent_id text, mls_agent_id text,
  first_name text NOT NULL, last_name text NOT NULL, email text, phone text,
  brokerage text, brokerage_address text, license_state text, license_number text,
  primary_zip_codes text[], avg_sale_price numeric(12,2),
  transactions_12m integer, transactions_90d integer,
  buyer_side_pct numeric(5,4), seller_side_pct numeric(5,4), avg_days_on_market integer,
  price_range_min numeric(12,2), price_range_max numeric(12,2),
  has_relationship boolean NOT NULL DEFAULT false, realtor_id uuid REFERENCES realtors(id) ON DELETE SET NULL,
  last_synced_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(attom_agent_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_rmp_org ON realtor_market_profiles(org_id) WHERE has_relationship = false;
ALTER TABLE realtor_market_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rmp_tenant" ON realtor_market_profiles;
CREATE POLICY "rmp_tenant" ON realtor_market_profiles FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS realtor_competitive_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realtor_id uuid REFERENCES realtors(id) ON DELETE CASCADE,
  market_profile_id uuid REFERENCES realtor_market_profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year integer NOT NULL, zip_code text, top_lenders jsonb, total_loans integer,
  conventional_pct numeric(5,4), fha_pct numeric(5,4), va_pct numeric(5,4), jumbo_pct numeric(5,4),
  data_source text NOT NULL DEFAULT 'hmda', synced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE realtor_competitive_intel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rci_tenant" ON realtor_competitive_intel;
CREATE POLICY "rci_tenant" ON realtor_competitive_intel FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS hmda_market_share (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL, zip_code text NOT NULL, lender_name text NOT NULL,
  loan_count integer NOT NULL DEFAULT 0, avg_loan_amount numeric(12,2),
  conventional_count integer, fha_count integer, va_count integer, jumbo_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, zip_code, lender_name)
);
CREATE INDEX IF NOT EXISTS idx_hmda_zip ON hmda_market_share(zip_code, year, loan_count DESC);
ALTER TABLE hmda_market_share ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hmda_read" ON hmda_market_share;
CREATE POLICY "hmda_read" ON hmda_market_share FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS realtor_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realtor_id uuid NOT NULL REFERENCES realtors(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  logged_by uuid REFERENCES profiles(id),
  event_type text NOT NULL CHECK (event_type IN ('coffee','open_house','industry_event','lunch','virtual','cold_intro','referral_intro','other')),
  event_date date NOT NULL, event_name text, notes text, next_step text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rm_realtor ON realtor_meetings(realtor_id, event_date DESC);
ALTER TABLE realtor_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rmeet_tenant" ON realtor_meetings;
CREATE POLICY "rmeet_tenant" ON realtor_meetings FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

ALTER TABLE realtors
  ADD COLUMN IF NOT EXISTS comarketing_cadence text DEFAULT 'monthly' CHECK (comarketing_cadence IN ('weekly','biweekly','monthly','quarterly','none')),
  ADD COLUMN IF NOT EXISTS last_comarketing_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_comarketing_due_at date;
ALTER TABLE realtor_touches ADD COLUMN IF NOT EXISTS touch_context text;
