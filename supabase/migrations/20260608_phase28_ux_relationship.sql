-- ============================================================
-- AshleyIQ — Phase 28: UX infrastructure + relationship layer
-- 2026-06-08 · idempotent
--
-- TRANSLATED from the generic Phase-28 spec to the REAL schema:
--   tenants/tenant_id  -> organizations/org_id
--   users(id)          -> profiles(id)
--   partners(id)       -> referral_partners(id)
--   leads.full_name    -> first_name || ' ' || last_name
--   qr_codes(id) FK    -> dropped; QR target stored inline (no qr table here)
--   RLS auth.uid()     -> public.get_org_id() (Clerk-not-Supabase auth)
-- INSERT-only audit tables REVOKE update/delete from ALL roles incl service_role.
-- ============================================================
BEGIN;

-- ── UW / disclosure backend (header KPIs + underwriting pages) ───────────────
CREATE TABLE IF NOT EXISTS dti_worksheets (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id                   uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  total_monthly_income      numeric(12,2) NOT NULL DEFAULT 0,
  proposed_housing_payment  numeric(12,2) NOT NULL DEFAULT 0,
  other_monthly_debts       numeric(12,2) NOT NULL DEFAULT 0,
  front_end_dti             numeric(5,2),
  back_end_dti              numeric(5,2),
  overrides                 jsonb NOT NULL DEFAULT '{}',
  updated_at                timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE TABLE IF NOT EXISTS uw_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  risk_score    smallint CHECK (risk_score BETWEEN 0 AND 100),
  risk_factors  jsonb NOT NULL DEFAULT '[]',
  status        text NOT NULL DEFAULT 'not_started'
                CHECK (status IN ('not_started','in_review','suspended','approved','denied')),
  decision      text CHECK (decision IN ('approve','approve_with_conditions','suspend','deny')),
  decision_notes text,
  decided_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

CREATE TABLE IF NOT EXISTS rate_lock_expirations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  rate             numeric(5,3),
  locked_at        timestamptz,
  lock_period_days integer NOT NULL DEFAULT 30,
  lock_expires_at  timestamptz,
  status           text NOT NULL DEFAULT 'floating'
                   CHECK (status IN ('floating','locked','expired','extended')),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id)
);

-- ── 28.4 — realtor portal access ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portal_realtors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_by         text NOT NULL CHECK (added_by IN ('borrower','lo')),
  realtor_name     text NOT NULL,
  realtor_email    text NOT NULL,
  realtor_phone    text,
  partner_id       uuid REFERENCES referral_partners(id) ON DELETE SET NULL,
  permission_tier  text NOT NULL DEFAULT 'status_only'
    CHECK (permission_tier IN ('status_only','transaction_partner','full_partner')),
  custom_permissions jsonb NOT NULL DEFAULT '{
    "see_stage": true, "see_milestones": true, "see_closing_date": true,
    "see_appraisal_status": false, "see_conditions_count": false,
    "see_rate_lock_expiry": false, "see_ctc_status": false, "message_lo": false
  }',
  token            text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32),'hex'),
  token_expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days',
  approved_by_lo   boolean NOT NULL DEFAULT false,
  approved_at      timestamptz,
  revoked          boolean NOT NULL DEFAULT false,
  revoked_at       timestamptz,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal_realtor_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realtor_id  uuid NOT NULL REFERENCES portal_realtors(id) ON DELETE CASCADE,
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN (
    'invited','approved','revoked','portal_viewed','milestone_viewed','message_sent')),
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_realtors_lead   ON portal_realtors(lead_id);
CREATE INDEX IF NOT EXISTS idx_portal_realtors_token  ON portal_realtors(token) WHERE revoked = false;
CREATE INDEX IF NOT EXISTS idx_portal_realtors_email  ON portal_realtors(realtor_email, org_id);
CREATE INDEX IF NOT EXISTS idx_portal_realtor_evt_lead ON portal_realtor_events(lead_id);

-- ── 28.5 — listings + co-marketing ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS realtor_listings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  realtor_id       uuid REFERENCES portal_realtors(id) ON DELETE SET NULL,
  partner_id       uuid REFERENCES referral_partners(id) ON DELETE SET NULL,
  address_line1    text NOT NULL,
  address_city     text NOT NULL,
  address_state    text NOT NULL,
  address_zip      text NOT NULL,
  list_price       numeric(12,2) NOT NULL,
  bedrooms         integer,
  bathrooms        numeric(4,1),
  sqft             integer,
  lot_size_sqft    integer,
  year_built       integer,
  property_type    text CHECK (property_type IN ('SFR','Condo','Townhouse','Multi-Family','Land','Commercial')),
  description      text,
  mls_number       text,
  listing_status   text NOT NULL DEFAULT 'active'
                   CHECK (listing_status IN ('active','pending','sold','off_market')),
  photo_urls        text[] NOT NULL DEFAULT '{}',
  primary_photo_url text,
  source           text NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('manual','zillow_url','mls')),
  zillow_url        text,
  zillow_zpid       text,
  zillow_last_sync  timestamptz,
  comarketing_active boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comarketing_assets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  listing_id       uuid NOT NULL REFERENCES realtor_listings(id) ON DELETE CASCADE,
  lo_id            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  realtor_id       uuid REFERENCES portal_realtors(id) ON DELETE SET NULL,
  partner_id       uuid REFERENCES referral_partners(id) ON DELETE SET NULL,
  asset_type       text NOT NULL CHECK (asset_type IN (
    'flyer_just_listed','flyer_open_house','flyer_just_sold',
    'social_square','social_story','social_landscape','email_banner')),
  qr_target_url    text,
  storage_url      text NOT NULL,
  thumbnail_url    text,
  download_count   integer NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comarketing_asset_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    uuid NOT NULL REFERENCES comarketing_assets(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  viewed_by   text NOT NULL CHECK (viewed_by IN ('lo','realtor','other')),
  action      text NOT NULL CHECK (action IN ('viewed','downloaded','shared')),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_org      ON realtor_listings(org_id);
CREATE INDEX IF NOT EXISTS idx_listings_partner  ON realtor_listings(partner_id);
CREATE INDEX IF NOT EXISTS idx_comarketing_list  ON comarketing_assets(listing_id);
CREATE INDEX IF NOT EXISTS idx_comarketing_lo    ON comarketing_assets(lo_id);

-- ── 28.7 — borrower lifetime relationships ───────────────────────────────────
CREATE TABLE IF NOT EXISTS borrower_relationships (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email                text NOT NULL,
  full_name            text NOT NULL,
  phone                text,
  lead_ids             uuid[] NOT NULL DEFAULT '{}',
  first_close_date     date,
  last_close_date      date,
  total_loans_closed   integer NOT NULL DEFAULT 0,
  total_volume_closed  numeric(14,2) NOT NULL DEFAULT 0,
  last_known_address   text,
  last_known_avm       numeric(12,2),
  last_known_avm_date  date,
  current_loan_balance numeric(12,2),
  estimated_equity     numeric(12,2) GENERATED ALWAYS AS (
    CASE WHEN last_known_avm IS NOT NULL AND current_loan_balance IS NOT NULL
    THEN last_known_avm - current_loan_balance ELSE NULL END) STORED,
  original_rate        numeric(5,3),
  current_market_rate  numeric(5,3),
  rate_delta           numeric(5,3) GENERATED ALWAYS AS (
    CASE WHEN original_rate IS NOT NULL AND current_market_rate IS NOT NULL
    THEN original_rate - current_market_rate ELSE NULL END) STORED,
  monthly_savings_if_refi numeric(10,2),
  refi_alert_sent      boolean NOT NULL DEFAULT false,
  refi_alert_threshold numeric(5,3) NOT NULL DEFAULT 0.75,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE TABLE IF NOT EXISTS relationship_rate_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES borrower_relationships(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_type    text NOT NULL CHECK (trigger_type IN ('rate_drop','equity_milestone','anniversary','market_update')),
  original_rate   numeric(5,3),
  current_rate    numeric(5,3),
  monthly_savings numeric(10,2),
  sent_via        text NOT NULL CHECK (sent_via IN ('sms','email','portal')),
  sent_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_borrower_rel_email ON borrower_relationships(org_id, email);

-- ── 28.8 — realtor lifetime relationships ────────────────────────────────────
CREATE TABLE IF NOT EXISTS realtor_relationships (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email                text NOT NULL,
  realtor_name         text NOT NULL,
  realtor_phone        text,
  realtor_license      text,
  brokerage            text,
  portal_realtor_ids   uuid[] NOT NULL DEFAULT '{}',
  total_transactions   integer NOT NULL DEFAULT 0,
  total_volume         numeric(14,2) NOT NULL DEFAULT 0,
  first_transaction_at date,
  last_transaction_at  date,
  avg_days_to_close    numeric(6,1),
  fallout_count        integer NOT NULL DEFAULT 0,
  referral_score       integer NOT NULL DEFAULT 100,
  preferred_programs   text[] DEFAULT '{}',
  listing_count        integer NOT NULL DEFAULT 0,
  comarketing_count    integer NOT NULL DEFAULT 0,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_realtor_rel_score ON realtor_relationships(org_id, referral_score DESC);

-- ── Triggers: auto-link relationships ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_borrower_relationship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  INSERT INTO borrower_relationships (org_id, email, full_name, phone, lead_ids)
  VALUES (
    NEW.org_id, lower(NEW.email),
    trim(coalesce(NEW.first_name,'') || ' ' || coalesce(NEW.last_name,'')),
    NEW.phone, ARRAY[NEW.id]
  )
  ON CONFLICT (org_id, email) DO UPDATE
    SET lead_ids  = CASE WHEN borrower_relationships.lead_ids @> ARRAY[NEW.id]
                         THEN borrower_relationships.lead_ids
                         ELSE array_append(borrower_relationships.lead_ids, NEW.id) END,
        full_name = EXCLUDED.full_name,
        phone     = COALESCE(EXCLUDED.phone, borrower_relationships.phone),
        updated_at = now();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let relationship bookkeeping block lead creation.
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_link_borrower_relationship ON leads;
CREATE TRIGGER trg_link_borrower_relationship
  AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION public.link_borrower_relationship();

CREATE OR REPLACE FUNCTION public.link_realtor_relationship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  INSERT INTO realtor_relationships (org_id, email, realtor_name, realtor_phone, portal_realtor_ids)
  VALUES (NEW.org_id, lower(NEW.realtor_email), NEW.realtor_name, NEW.realtor_phone, ARRAY[NEW.id])
  ON CONFLICT (org_id, email) DO UPDATE
    SET portal_realtor_ids = CASE WHEN realtor_relationships.portal_realtor_ids @> ARRAY[NEW.id]
                                  THEN realtor_relationships.portal_realtor_ids
                                  ELSE array_append(realtor_relationships.portal_realtor_ids, NEW.id) END,
        realtor_name  = EXCLUDED.realtor_name,
        realtor_phone = COALESCE(EXCLUDED.realtor_phone, realtor_relationships.realtor_phone),
        updated_at = now();
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS trg_link_realtor_relationship ON portal_realtors;
CREATE TRIGGER trg_link_realtor_relationship
  AFTER INSERT ON portal_realtors FOR EACH ROW EXECUTE FUNCTION public.link_realtor_relationship();

-- Backfill borrower relationships from existing leads.
INSERT INTO borrower_relationships (org_id, email, full_name, phone, lead_ids)
SELECT org_id, lower(email),
       trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')),
       (array_agg(phone) FILTER (WHERE phone IS NOT NULL))[1],
       array_agg(id)
FROM leads
GROUP BY org_id, lower(email),
         trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
ON CONFLICT (org_id, email) DO NOTHING;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE dti_worksheets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE uw_files                ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_lock_expirations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_realtors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_realtor_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtor_listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comarketing_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comarketing_asset_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrower_relationships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_rate_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtor_relationships   ENABLE ROW LEVEL SECURITY;

DO $pol$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dti_worksheets','uw_files','rate_lock_expirations','portal_realtors',
    'realtor_listings','comarketing_assets','borrower_relationships','realtor_relationships'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_tenant', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id())', t||'_tenant', t);
  END LOOP;
END
$pol$;

-- INSERT-only audit tables: insert policy + hard revoke of update/delete.
DO $audit$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['portal_realtor_events','comarketing_asset_views','relationship_rate_alerts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_insert', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (true)', t||'_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_select', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (org_id = public.get_org_id())', t||'_select', t);
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON %I FROM anon, authenticated, service_role', t);
  END LOOP;
END
$audit$;

COMMIT;
