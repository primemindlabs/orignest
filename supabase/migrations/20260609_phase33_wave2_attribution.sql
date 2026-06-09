-- ============================================================
-- Ashley IQ — Phase 33 · Wave 2: Ad Performance Attribution
-- 2026-06-09
--
-- UTM capture + Meta/Google performance import + ROAS by campaign.
-- Meta/Google OAuth + daily sync are GATED (no API creds) — the sync route
-- returns 501 until connections exist. Tables + UTM capture + dashboard are live.
-- Real schema: tenant_id -> org_id; get_org_id() RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS ad_platform_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      text NOT NULL,
  platform        text NOT NULL CHECK (platform IN ('meta','google')),
  account_id      text NOT NULL,
  account_name    text,
  access_token    text,                  -- TODO: store via Supabase Vault when OAuth is wired
  refresh_token   text,
  token_expires_at timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  last_sync_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apc_org ON ad_platform_connections(org_id, platform);
ALTER TABLE ad_platform_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "apc_select" ON ad_platform_connections;
CREATE POLICY "apc_select" ON ad_platform_connections FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "apc_write" ON ad_platform_connections;
CREATE POLICY "apc_write" ON ad_platform_connections FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS ad_campaign_stats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id   uuid REFERENCES ad_platform_connections(id) ON DELETE CASCADE,
  platform        text NOT NULL,
  campaign_id     text NOT NULL,
  campaign_name   text NOT NULL,
  ad_set_id       text,
  ad_set_name     text,
  ad_id           text,
  ad_name         text,
  date            date NOT NULL,
  impressions     integer NOT NULL DEFAULT 0,
  clicks          integer NOT NULL DEFAULT 0,
  spend_cents     integer NOT NULL DEFAULT 0,
  leads_count     integer NOT NULL DEFAULT 0,
  synced_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_acs_unique ON ad_campaign_stats(org_id, platform, campaign_id, (COALESCE(ad_id, '')), date);
CREATE INDEX IF NOT EXISTS idx_acs_org_date ON ad_campaign_stats(org_id, date DESC);
ALTER TABLE ad_campaign_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acs_select" ON ad_campaign_stats;
CREATE POLICY "acs_select" ON ad_campaign_stats FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "acs_write" ON ad_campaign_stats;
CREATE POLICY "acs_write" ON ad_campaign_stats FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS lead_ad_attribution (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform        text,
  campaign_id     text,
  ad_set_id       text,
  ad_id           text,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  attributed_at   timestamptz NOT NULL DEFAULT now(),
  funded_loan_amount_cents bigint,
  UNIQUE (lead_id)
);
CREATE INDEX IF NOT EXISTS idx_laa_org_campaign ON lead_ad_attribution(org_id, campaign_id);
ALTER TABLE lead_ad_attribution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "laa_select" ON lead_ad_attribution;
CREATE POLICY "laa_select" ON lead_ad_attribution FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "laa_write" ON lead_ad_attribution;
CREATE POLICY "laa_write" ON lead_ad_attribution FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
