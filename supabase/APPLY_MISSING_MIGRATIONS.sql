-- AshleyIQ: apply missing migrations (idempotent). Paste into Supabase SQL Editor and Run.
-- Safe to re-run. Project ref: dhnxiijduycmzfjmohyp

BEGIN;

-- ============ 20260604_financial_calc_suite.sql ============
-- ============================================================
-- Orignest — Financial Calculation Suite
-- 2026-06-04
-- ============================================================

-- ============================================================
-- PRICING SCENARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_scenarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  name                  TEXT NOT NULL DEFAULT 'Untitled Scenario',
  inputs                JSONB NOT NULL,
  results               JSONB NOT NULL,
  shared_with_borrower  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_scenarios_org_id ON pricing_scenarios(org_id, created_at DESC);
CREATE INDEX idx_pricing_scenarios_lead_id ON pricing_scenarios(lead_id);

ALTER TABLE pricing_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_scenarios_org" ON pricing_scenarios;
CREATE POLICY "pricing_scenarios_org" ON pricing_scenarios FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- ============================================================
-- COMMERCIAL DEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_deals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  deal_type             TEXT NOT NULL CHECK (
                          deal_type IN (
                            'multifamily', 'commercial', 'mixed_use',
                            'sba', 'bridge', 'construction'
                          )
                        ),
  property_address      TEXT,
  purchase_price        NUMERIC(14, 2),
  loan_amount           NUMERIC(14, 2),
  noi                   NUMERIC(14, 2),
  cap_rate              NUMERIC(5, 3),
  dscr                  NUMERIC(5, 3),
  bridge_maturity_date  DATE,
  exit_strategy         TEXT,
  status                TEXT NOT NULL DEFAULT 'analyzing'
                          CHECK (
                            status IN (
                              'analyzing', 'submitted', 'approved',
                              'closed', 'declined'
                            )
                          ),
  analysis_data         JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commercial_deals_org_id ON commercial_deals(org_id, created_at DESC);
CREATE INDEX idx_commercial_deals_lead_id ON commercial_deals(lead_id);
CREATE INDEX idx_commercial_deals_status ON commercial_deals(org_id, status);
CREATE INDEX idx_commercial_deals_bridge_maturity ON commercial_deals(bridge_maturity_date)
  WHERE bridge_maturity_date IS NOT NULL;

ALTER TABLE commercial_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_deals_org" ON commercial_deals;
CREATE POLICY "commercial_deals_org" ON commercial_deals FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_commercial_deals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_commercial_deals_updated_at
  BEFORE UPDATE ON commercial_deals
  FOR EACH ROW
  EXECUTE FUNCTION update_commercial_deals_updated_at();

-- ============================================================
-- NON-QM ANALYSES (saved DSCR / bank statement / asset depletion / P&L)
-- ============================================================
CREATE TABLE IF NOT EXISTS nonqm_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  analysis_type   TEXT NOT NULL CHECK (
                    analysis_type IN (
                      'dscr', 'bank_statement', 'asset_depletion',
                      'pl_1099', 'fix_flip'
                    )
                  ),
  name            TEXT NOT NULL DEFAULT 'Untitled Analysis',
  inputs          JSONB NOT NULL,
  results         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nonqm_analyses_org_id ON nonqm_analyses(org_id, created_at DESC);
CREATE INDEX idx_nonqm_analyses_lead_id ON nonqm_analyses(lead_id);

ALTER TABLE nonqm_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nonqm_analyses_org" ON nonqm_analyses;
CREATE POLICY "nonqm_analyses_org" ON nonqm_analyses FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- ============ 20260604_lenders_revenue.sql ============
-- ============================================================
-- Orignest — Lenders, Revenue Intelligence, Commissions
-- 2026-06-04
-- ============================================================

-- ============================================================
-- LENDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS lenders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  channel             text NOT NULL CHECK (channel IN ('wholesale','correspondent','direct','hard_money','private')),
  website             text,
  ae_name             text,
  ae_phone            text,
  ae_email            text,
  products            text[] NOT NULL DEFAULT '{}',
  licensed_states     text[] NOT NULL DEFAULT '{}',
  min_fico            integer,
  max_ltv             numeric(5,2),
  specialty_tags      text[] NOT NULL DEFAULT '{}',
  avg_turnaround_days integer,
  is_preferred        boolean NOT NULL DEFAULT false,
  notes               text,
  loans_submitted     integer NOT NULL DEFAULT 0,
  loans_closed        integer NOT NULL DEFAULT 0,
  avg_days_to_close   integer,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lenders_org_id ON lenders(org_id);
CREATE INDEX IF NOT EXISTS idx_lenders_org_preferred ON lenders(org_id, is_preferred DESC);

ALTER TABLE lenders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lenders_org" ON lenders;
CREATE POLICY "lenders_org" ON lenders FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- ============================================================
-- LENDER PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lender_products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id        uuid NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_type        text NOT NULL,
  min_fico         integer,
  max_ltv          numeric(5,2),
  max_dti          numeric(5,2),
  max_loan_amount  numeric(14,2),
  allowed_states   text[] DEFAULT '{}',
  overlay_notes    text,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lender_products_lender_id ON lender_products(lender_id);
CREATE INDEX IF NOT EXISTS idx_lender_products_org_id ON lender_products(org_id);

ALTER TABLE lender_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lender_products_org" ON lender_products;
CREATE POLICY "lender_products_org" ON lender_products FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- ============================================================
-- LENDER COMM LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS lender_comm_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id   uuid NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lender_comm_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lender_comm_log_org" ON lender_comm_log;
CREATE POLICY "lender_comm_log_org" ON lender_comm_log FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- ============================================================
-- COMMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS commissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lo_id                 uuid NOT NULL REFERENCES profiles(id),
  loan_amount           numeric(14,2) NOT NULL,
  close_date            date NOT NULL,
  loan_type             text NOT NULL,
  compensation_type     text NOT NULL CHECK (compensation_type IN ('lender_paid','borrower_paid')),
  compensation_bps      numeric(6,2),
  compensation_amount   numeric(12,2) NOT NULL,
  referral_fee_amount   numeric(12,2) NOT NULL DEFAULT 0,
  net_revenue           numeric(12,2),
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','paid','clawed_back')),
  payment_date          date,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_org_id ON commissions(org_id);
CREATE INDEX IF NOT EXISTS idx_commissions_lo_id ON commissions(lo_id);
CREATE INDEX IF NOT EXISTS idx_commissions_close_date ON commissions(org_id, close_date DESC);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commissions_org" ON commissions;
CREATE POLICY "commissions_org" ON commissions FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- ============================================================
-- LO PERFORMANCE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lo_performance_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_month    date NOT NULL, -- first day of the month
  loans_originated integer NOT NULL DEFAULT 0,
  total_volume    numeric(16,2) NOT NULL DEFAULT 0,
  total_revenue   numeric(12,2) NOT NULL DEFAULT 0,
  avg_loan_size   numeric(14,2),
  pull_through_rate numeric(5,2),
  avg_days_to_close integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- NOTE: live base table uses snapshot_date (the 20260604 redefinition with period_month was stale
-- and never reached the DB; code upserts onConflict (org_id, lo_id, snapshot_date)). Match live schema.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lo_performance_unique ON lo_performance_snapshots(org_id, lo_id, snapshot_date);

ALTER TABLE lo_performance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lo_performance_org" ON lo_performance_snapshots;
CREATE POLICY "lo_performance_org" ON lo_performance_snapshots FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- ============ 20260604_marketing_suite.sql ============
-- ============================================================
-- Conduit CRM — Marketing & Lead Generation Suite
-- Migration: 20260604_marketing_suite.sql
-- ============================================================

-- ── Helper alias (public schema wrapper for public.get_org_id) ─────────────────
CREATE OR REPLACE FUNCTION public.get_org_id() RETURNS uuid AS $$
  SELECT id FROM organizations
  WHERE clerk_org_id = (current_setting('request.jwt.claims', true)::json ->> 'org_id')
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Ad Campaigns ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       uuid NOT NULL REFERENCES profiles(id),
  name             text NOT NULL,
  platform         text NOT NULL CHECK (platform IN ('facebook','google','instagram','linkedin','email')),
  goal             text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','paused','completed')),
  target_config    jsonb NOT NULL DEFAULT '{}',
  creative_config  jsonb NOT NULL DEFAULT '{}',
  daily_budget     numeric(8,2),
  start_date       date,
  end_date         date,
  leads_generated  integer NOT NULL DEFAULT 0,
  spend_to_date    numeric(10,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_org ON ad_campaigns(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(org_id, status);

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad_campaigns_org" ON ad_campaigns;
CREATE POLICY "ad_campaigns_org" ON ad_campaigns
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Landing Pages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS landing_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           uuid REFERENCES profiles(id) ON DELETE CASCADE,
  slug            text UNIQUE NOT NULL,
  headline        text NOT NULL,
  subheadline     text,
  features        jsonb NOT NULL DEFAULT '[]',
  lo_config       jsonb NOT NULL DEFAULT '{}',
  active          boolean NOT NULL DEFAULT true,
  page_views      integer NOT NULL DEFAULT 0,
  leads_captured  integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_org ON landing_pages(org_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);

ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "landing_pages_org" ON landing_pages;
CREATE POLICY "landing_pages_org" ON landing_pages
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Social Posts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  platform        text NOT NULL CHECK (platform IN ('linkedin','instagram','facebook','twitter')),
  content_type    text NOT NULL,
  tone            text NOT NULL DEFAULT 'professional'
                  CHECK (tone IN ('professional','conversational','educational')),
  body            text NOT NULL,
  hashtags        text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','posted')),
  scheduled_at    timestamptz,
  posted_at       timestamptz,
  compliance_flag boolean NOT NULL DEFAULT false,
  compliance_note text,
  engagement_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_org ON social_posts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(org_id, status, scheduled_at);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_posts_org" ON social_posts;
CREATE POLICY "social_posts_org" ON social_posts
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Co-Marketing Materials ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS co_marketing_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  partner_id      uuid REFERENCES referral_partners(id) ON DELETE SET NULL,
  material_type   text NOT NULL CHECK (material_type IN (
                    'rate_sheet','open_house_flyer','just_closed_post',
                    'buyers_guide','email_signature'
                  )),
  content         jsonb NOT NULL DEFAULT '{}',
  preview_html    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_co_mktg_org ON co_marketing_materials(org_id, created_at DESC);

ALTER TABLE co_marketing_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "co_mktg_org" ON co_marketing_materials;
CREATE POLICY "co_mktg_org" ON co_marketing_materials
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Nurture Sequences ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nurture_sequences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sequence_type   text NOT NULL,
  scheduled_date  timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','sent','skipped','bounced')),
  content         text,
  sent_at         timestamptz,
  opened_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nurture_org ON nurture_sequences(org_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_nurture_lead ON nurture_sequences(lead_id, status);
CREATE INDEX IF NOT EXISTS idx_nurture_upcoming ON nurture_sequences(org_id, status, scheduled_date)
  WHERE status = 'scheduled';

ALTER TABLE nurture_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nurture_sequences_org" ON nurture_sequences;
CREATE POLICY "nurture_sequences_org" ON nurture_sequences
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Updated-at triggers ───────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ad_campaigns','social_posts'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE ad_campaigns IS 'Paid advertising campaign records for Facebook, Google, LinkedIn, Instagram.';
COMMENT ON TABLE landing_pages IS 'LO-specific landing pages with pre-qual form embed and compliance footer.';
COMMENT ON TABLE social_posts IS 'AI-generated social media content library and schedule.';
COMMENT ON TABLE co_marketing_materials IS 'Co-branded materials generated for LO + referral partner pairs.';
COMMENT ON TABLE nurture_sequences IS 'Post-close borrower retention and referral nurture touchpoints.';

-- ============ 20260604_origination_suite.sql ============
-- ============================================================
-- Orignest — Origination & Compliance Suite
-- 2026-06-04
-- Feature: Digital 1003, NMLS Compliance, Credit Repair Pipeline
-- ============================================================

-- ============================================================
-- HELPER: get_org_id() — used in RLS policies below
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM organizations
  WHERE clerk_org_id = (
    SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
  )
  LIMIT 1;
$$;

-- ============================================================
-- LOAN APPLICATIONS (Digital 1003 / URLA)
-- ============================================================
CREATE TABLE IF NOT EXISTS loan_applications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  application_type      text NOT NULL CHECK (application_type IN ('residential','nonqm','commercial')),
  status                text NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','submitted','in_review','approved','denied','withdrawn')),
  current_section       integer NOT NULL DEFAULT 1,
  total_sections        integer NOT NULL DEFAULT 9,
  -- Encrypted PII fields (AES-256, encrypted at application layer)
  ssn_encrypted         text,
  ssn_iv                text,
  dob_encrypted         text,
  dob_iv                text,
  -- Co-borrower PII
  co_ssn_encrypted      text,
  co_ssn_iv             text,
  co_dob_encrypted      text,
  co_dob_iv             text,
  -- Section data (JSONB — non-PII structured data per section)
  borrower_data         jsonb NOT NULL DEFAULT '{}',
  employment_data       jsonb NOT NULL DEFAULT '{}',
  assets_data           jsonb NOT NULL DEFAULT '{}',
  liabilities_data      jsonb NOT NULL DEFAULT '{}',
  real_estate_data      jsonb NOT NULL DEFAULT '[]',
  property_data         jsonb NOT NULL DEFAULT '{}',
  loan_data             jsonb NOT NULL DEFAULT '{}',
  declarations_data     jsonb NOT NULL DEFAULT '{}',
  military_data         jsonb NOT NULL DEFAULT '{}',
  demographic_data      jsonb NOT NULL DEFAULT '{}',
  lo_data               jsonb NOT NULL DEFAULT '{}',
  -- Non-QM specific
  income_type           text CHECK (income_type IN (
                          'w2','self_employed','bank_statement','1099',
                          'dscr','asset_depletion','p_and_l','no_doc'
                        )),
  nonqm_data            jsonb,
  -- Commercial specific
  commercial_data       jsonb,
  -- Calculated / derived
  total_monthly_income  numeric(12,2),
  total_monthly_debts   numeric(12,2),
  front_dti             numeric(5,2),
  back_dti              numeric(5,2),
  loan_amount           numeric(14,2),
  ltv                   numeric(5,2),
  -- Application token for borrower portal link
  application_token     text UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
  -- Timestamps
  submitted_at          timestamptz,
  approved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_loan_applications_org_id   ON loan_applications(org_id);
CREATE INDEX idx_loan_applications_lead_id  ON loan_applications(lead_id);
CREATE INDEX idx_loan_applications_status   ON loan_applications(org_id, status);

ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loan_applications_org" ON loan_applications;
CREATE POLICY "loan_applications_org" ON loan_applications FOR ALL
  USING  (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- NMLS LICENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS nmls_licenses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id            uuid REFERENCES profiles(id) ON DELETE CASCADE,
  nmls_id               text NOT NULL,
  license_type          text NOT NULL CHECK (license_type IN ('company','individual')),
  state                 char(2) NOT NULL,
  license_number        text,
  status                text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','pending','expired','suspended','surrendered')),
  expiration_date       date,
  last_verified_at      timestamptz,
  ce_hours_required     integer NOT NULL DEFAULT 8,
  ce_hours_completed    integer NOT NULL DEFAULT 0,
  ce_courses            jsonb NOT NULL DEFAULT '[]',
  safe_exam_passed      boolean,
  safe_exam_date        date,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, nmls_id, state)
);

CREATE INDEX idx_nmls_licenses_org_id      ON nmls_licenses(org_id);
CREATE INDEX idx_nmls_licenses_profile_id  ON nmls_licenses(profile_id);
CREATE INDEX idx_nmls_licenses_expiry      ON nmls_licenses(org_id, expiration_date)
  WHERE status = 'active';

ALTER TABLE nmls_licenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nmls_licenses_org" ON nmls_licenses;
CREATE POLICY "nmls_licenses_org" ON nmls_licenses FOR ALL
  USING  (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- CREDIT REPAIR PIPELINE
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_repair_pipeline (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id                   uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  target_program            text NOT NULL,
  target_score              integer NOT NULL CHECK (target_score BETWEEN 300 AND 850),
  starting_score            integer NOT NULL CHECK (starting_score BETWEEN 300 AND 850),
  current_score             integer CHECK (current_score BETWEEN 300 AND 850),
  score_history             jsonb NOT NULL DEFAULT '[]',
  -- e.g. [{"date":"2026-06-04","score":591,"notes":"Initial pull"},...]
  known_issues              jsonb NOT NULL DEFAULT '[]',
  -- e.g. [{"type":"collection","amount":1200,"creditor":"Medical","status":"open"},...]
  status                    text NOT NULL DEFAULT 'enrolled'
                              CHECK (status IN (
                                'enrolled','in_progress','near_qualifying',
                                'qualified','stopped_responding','reactivated'
                              )),
  credit_repair_partner     text,
  checkin_frequency_days    integer NOT NULL DEFAULT 30,
  next_checkin_date         date,
  assigned_to               uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reactivated_at            timestamptz,
  ai_action_plan            text,
  ai_plan_generated_at      timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, lead_id)
);

CREATE INDEX idx_credit_repair_org_id      ON credit_repair_pipeline(org_id);
CREATE INDEX idx_credit_repair_status      ON credit_repair_pipeline(org_id, status);
CREATE INDEX idx_credit_repair_checkin     ON credit_repair_pipeline(org_id, next_checkin_date)
  WHERE status NOT IN ('qualified','stopped_responding');

ALTER TABLE credit_repair_pipeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_repair_org" ON credit_repair_pipeline;
CREATE POLICY "credit_repair_org" ON credit_repair_pipeline FOR ALL
  USING  (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- CREDIT REPAIR PARTNERS (reference directory)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_repair_partners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name              text NOT NULL,
  contact_name      text,
  email             text,
  phone             text,
  website           text,
  avg_timeline_days integer,
  success_rate      numeric(5,2) CHECK (success_rate BETWEEN 0 AND 100),
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_repair_partners_org ON credit_repair_partners(org_id);

ALTER TABLE credit_repair_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_repair_partners_org" ON credit_repair_partners;
CREATE POLICY "credit_repair_partners_org" ON credit_repair_partners FOR ALL
  USING  (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- EXTEND AuditAction — add new actions (comment only, enforced at app layer)
-- New values: APPLICATION_CREATED, APPLICATION_UPDATED, APPLICATION_SUBMITTED,
--             NMLS_VERIFIED, CREDIT_REPAIR_ENROLLED, CREDIT_REPAIR_SCORE_UPDATED,
--             CREDIT_REPAIR_REACTIVATED
-- ============================================================

-- ============ 20260605_communication_hub.sql ============
-- ============================================================
-- Conduit CRM — Communication Hub
-- Migration: 20260605_communication_hub.sql
-- Features: Unified Inbox, Video Messages, Doc Templates,
--           NPS Responses, Email Integrations
-- ============================================================

-- ── Inbound Messages (unified inbox) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbound_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES leads(id) ON DELETE SET NULL,
  channel       text NOT NULL CHECK (channel IN ('sms','email','instagram','facebook','voicemail')),
  from_address  text NOT NULL, -- phone number or email address
  to_address    text NOT NULL,
  body          text NOT NULL,
  raw_payload   jsonb,
  read_at       timestamptz,
  replied_at    timestamptz,
  lo_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_messages_org      ON inbound_messages(org_id, created_at DESC);
CREATE INDEX idx_inbound_messages_lead     ON inbound_messages(lead_id, created_at DESC);
CREATE INDEX idx_inbound_messages_unread   ON inbound_messages(org_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_inbound_messages_channel  ON inbound_messages(org_id, channel, created_at DESC);

ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inbound_messages_org" ON inbound_messages;
CREATE POLICY "inbound_messages_org" ON inbound_messages FOR ALL
  USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ── Video Messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id            uuid NOT NULL REFERENCES profiles(id),
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  storage_path     text NOT NULL,
  public_url       text NOT NULL,
  thumbnail_url    text,
  duration_seconds integer,
  title            text,
  view_count       integer NOT NULL DEFAULT 0,
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE video_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "video_messages_org" ON video_messages;
CREATE POLICY "video_messages_org" ON video_messages FOR ALL
  USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
-- Public select for shareable links (no auth required to view a video)
DROP POLICY IF EXISTS "video_messages_public_select" ON video_messages;
CREATE POLICY "video_messages_public_select" ON video_messages FOR SELECT USING (TRUE);

-- ── Document Templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = system template
  category      text NOT NULL,
  name          text NOT NULL,
  description   text,
  template_html text NOT NULL, -- HTML with {{variable}} placeholders
  variables     jsonb NOT NULL DEFAULT '[]',
  is_system     boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  use_count     integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_all_select" ON document_templates;
CREATE POLICY "templates_all_select" ON document_templates FOR SELECT
  USING (is_system = true OR org_id = public.get_org_id());
DROP POLICY IF EXISTS "templates_org_write" ON document_templates;
CREATE POLICY "templates_org_write" ON document_templates FOR ALL
  USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ── Generated Documents ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id        uuid REFERENCES leads(id) ON DELETE SET NULL,
  template_id    uuid REFERENCES document_templates(id),
  generated_html text NOT NULL,
  generated_by   uuid NOT NULL REFERENCES profiles(id),
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "generated_docs_org" ON generated_documents;
CREATE POLICY "generated_docs_org" ON generated_documents FOR ALL
  USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ── NPS Responses ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nps_responses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lo_id                 uuid REFERENCES profiles(id),
  score                 integer CHECK (score BETWEEN 1 AND 10),
  sent_at               timestamptz NOT NULL DEFAULT now(),
  responded_at          timestamptz,
  review_requested_at   timestamptz,
  review_link_clicked   boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nps_org" ON nps_responses;
CREATE POLICY "nps_org" ON nps_responses FOR ALL
  USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ── Email Integrations (Gmail / Outlook) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_integrations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider                text NOT NULL CHECK (provider IN ('gmail','outlook')),
  email_address           text NOT NULL,
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  last_sync_at            timestamptz,
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, profile_id, provider)
);

ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_integrations_org" ON email_integrations;
CREATE POLICY "email_integrations_org" ON email_integrations FOR ALL
  USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ── Social DM Accounts ────────────────────────────────────────────────────────
-- Stores connected Instagram/Facebook accounts per org for DM routing
CREATE TABLE IF NOT EXISTS social_dm_accounts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform               text NOT NULL CHECK (platform IN ('instagram','facebook','linkedin','twitter')),
  account_id             text NOT NULL,
  account_name           text NOT NULL,
  access_token_encrypted text,
  connected_at           timestamptz NOT NULL DEFAULT now(),
  active                 boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, platform, account_id)
);
ALTER TABLE social_dm_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "social_dm_org" ON social_dm_accounts;
CREATE POLICY "social_dm_org" ON social_dm_accounts
  FOR ALL
  USING  (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- Extend inbound_messages with social_platform column
ALTER TABLE inbound_messages
  ADD COLUMN IF NOT EXISTS social_platform text,   -- 'instagram' | 'facebook' | null
  ADD COLUMN IF NOT EXISTS external_id    text;    -- Meta message ID / Twilio SID

-- ── pg_cron: weekly performance email ─────────────────────────────────────────
-- Runs every Monday at 7:30am UTC
-- Requires pg_cron extension to be enabled
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'weekly-performance-email',
      '30 7 * * 1',
      format(
        $$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            ''Authorization'', ''Bearer '' || current_setting(''app.service_role_key''),
            ''Content-Type'', ''application/json''
          ),
          body := ''{}''::jsonb
        )$$,
        current_setting('app.supabase_functions_url', true) || '/weekly-performance-email'
      )
    );
  END IF;
END;
$do$;

-- ============ 20260605_processing_suite.sql ============
-- ============================================================
-- Conduit CRM — Processing Suite Migration
-- Features: Conditions, Milestones, Closing Checklist,
--           Cross-Tenant Processor, AI Learning Loop
-- ============================================================

-- ── Helper alias (public schema) ─────────────────────────────────────────────
-- Mirrors public.get_org_id() so policies can use public.get_org_id()
CREATE OR REPLACE FUNCTION public.get_org_id() RETURNS uuid AS $$
  SELECT id FROM organizations
  WHERE clerk_org_id = (current_setting('request.jwt.claims', true)::json ->> 'org_id')
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Document Requests ─────────────────────────────────────────────────────────
-- Referenced by loan_conditions; must exist before that table
CREATE TABLE IF NOT EXISTS document_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    uuid NOT NULL REFERENCES profiles(id),
  document_type   text NOT NULL,
  description     text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','received','rejected')),
  due_date        date,
  received_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "document_requests_org" ON document_requests;
CREATE POLICY "document_requests_org" ON document_requests
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Loan Conditions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_conditions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  condition_text      text NOT NULL,
  category            text NOT NULL
                      CHECK (category IN ('income','credit','assets','property','title','insurance','other')),
  priority            text NOT NULL DEFAULT 'standard'
                      CHECK (priority IN ('standard','prior_to_docs','prior_to_funding','prior_to_closing')),
  status              text NOT NULL DEFAULT 'issued'
                      CHECK (status IN ('issued','submitted','received','under_review','cleared','suspended')),
  assigned_to         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  document_request_id uuid REFERENCES document_requests(id) ON DELETE SET NULL,
  due_date            date,
  notes               text,
  cleared_at          timestamptz,
  cleared_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conditions_lead   ON loan_conditions(lead_id);
CREATE INDEX IF NOT EXISTS idx_conditions_org    ON loan_conditions(org_id, status);
CREATE INDEX IF NOT EXISTS idx_conditions_status ON loan_conditions(org_id, status, priority);

ALTER TABLE loan_conditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conditions_org" ON loan_conditions;
CREATE POLICY "conditions_org" ON loan_conditions
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Loan Milestones ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_milestones (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  milestone_key      text NOT NULL,
  milestone_label    text NOT NULL,
  responsible_party  text NOT NULL
                     CHECK (responsible_party IN ('lo','processor','borrower','title','lender','appraiser')),
  completed          boolean NOT NULL DEFAULT false,
  completed_at       timestamptz,
  completed_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date           date,
  sequence_order     integer NOT NULL,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_milestones_lead ON loan_milestones(lead_id, sequence_order);

ALTER TABLE loan_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "milestones_org" ON loan_milestones;
CREATE POLICY "milestones_org" ON loan_milestones
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Closing Checklist Items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS closing_checklist_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  section      text NOT NULL
               CHECK (section IN ('appraisal','title','hoi','flood','closing')),
  item_key     text NOT NULL,
  item_label   text NOT NULL,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  value_field  text,
  date_field   date,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_lead ON closing_checklist_items(lead_id, section);

ALTER TABLE closing_checklist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checklist_org" ON closing_checklist_items;
CREATE POLICY "checklist_org" ON closing_checklist_items
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Processor Assignments (cross-tenant) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS processor_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processor_user_id   text NOT NULL,    -- Clerk user ID
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_by         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_level        text NOT NULL DEFAULT 'processor'
                      CHECK (access_level IN ('processor','senior_processor')),
  active              boolean NOT NULL DEFAULT true,
  invited_at          timestamptz NOT NULL DEFAULT now(),
  accepted_at         timestamptz,
  expires_at          timestamptz,
  UNIQUE (processor_user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_proc_assignments_user ON processor_assignments(processor_user_id, active);
CREATE INDEX IF NOT EXISTS idx_proc_assignments_org  ON processor_assignments(org_id);

ALTER TABLE processor_assignments ENABLE ROW LEVEL SECURITY;
-- Org admins/managers can manage their assignments
DROP POLICY IF EXISTS "processor_assignments_org" ON processor_assignments;
CREATE POLICY "processor_assignments_org" ON processor_assignments
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());
-- Processors can read their own assignments (cross-org)
DROP POLICY IF EXISTS "processor_assignments_self" ON processor_assignments;
CREATE POLICY "processor_assignments_self" ON processor_assignments
  FOR SELECT USING (processor_user_id = (auth.jwt() ->> 'sub'));

-- ── Processor File Assignments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processor_file_assignments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processor_user_id   text NOT NULL,
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_by         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  active              boolean NOT NULL DEFAULT true,
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processor_user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_pfa_user    ON processor_file_assignments(processor_user_id, active);
CREATE INDEX IF NOT EXISTS idx_pfa_org     ON processor_file_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_pfa_lead    ON processor_file_assignments(lead_id);

ALTER TABLE processor_file_assignments ENABLE ROW LEVEL SECURITY;
-- Org admins can manage their file assignments
DROP POLICY IF EXISTS "pfa_org" ON processor_file_assignments;
CREATE POLICY "pfa_org" ON processor_file_assignments
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());
-- Processors read their own file assignments (cross-org — the ONLY cross-tenant query)
DROP POLICY IF EXISTS "pfa_self" ON processor_file_assignments;
CREATE POLICY "pfa_self" ON processor_file_assignments
  FOR SELECT USING (processor_user_id = (auth.jwt() ->> 'sub'));

-- ── AI Feedback (learning loop) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         text NOT NULL,
  ai_type         text NOT NULL
                  CHECK (ai_type IN (
                    'lead_score','sms_draft','email_draft','morning_briefing',
                    'deal_analysis','conditions_parse'
                  )),
  input_context   jsonb NOT NULL,
  ai_output       text NOT NULL,
  user_action     text NOT NULL
                  CHECK (user_action IN ('accepted','edited','rejected','no_action')),
  edited_output   text,
  outcome_metric  text,  -- filled in later: 'lead_converted','loan_closed','no_response'
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_org  ON ai_feedback(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_feedback(org_id, ai_type, user_action);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_feedback_org" ON ai_feedback;
CREATE POLICY "ai_feedback_org" ON ai_feedback
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Org AI Insights (learned per-org patterns) ────────────────────────────────
CREATE TABLE IF NOT EXISTS org_ai_insights (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Contact timing
  best_contact_hour         integer,
  best_contact_day          text,
  avg_response_rate_sms     numeric(5,2),
  avg_response_rate_email   numeric(5,2),
  -- Business patterns
  top_lead_sources          text[],
  top_loan_types            text[],
  avg_days_to_close         integer,
  avg_credit_score_closed   integer,
  -- Communication style
  preferred_sms_length      text CHECK (preferred_sms_length IN ('short','medium','long')),
  preferred_tone            text CHECK (preferred_tone IN ('formal','conversational','direct')),
  -- Score calibration weights
  score_weight_loan_amount  numeric(4,2) DEFAULT 1.0,
  score_weight_credit       numeric(4,2) DEFAULT 1.0,
  score_weight_source       numeric(4,2) DEFAULT 1.0,
  last_recalibrated_at      timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE org_ai_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_ai_insights_org" ON org_ai_insights;
CREATE POLICY "org_ai_insights_org" ON org_ai_insights
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Updated-at triggers for new tables ───────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'document_requests',
    'loan_conditions',
    'org_ai_insights'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ── Indexes for processing dashboard KPIs ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_conditions_open ON loan_conditions(org_id, lead_id)
  WHERE status NOT IN ('cleared','suspended');

CREATE INDEX IF NOT EXISTS idx_conditions_priority ON loan_conditions(org_id, priority)
  WHERE status NOT IN ('cleared','suspended');

-- ── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE processor_file_assignments IS
  'Cross-tenant processor access. ONLY table where a user may read data from an org they are not a member of. Scoped to individual lead assignments only.';
COMMENT ON TABLE ai_feedback IS
  'Passive AI learning loop. Never asks user for feedback — observes accept/edit/reject behavior automatically.';
COMMENT ON TABLE org_ai_insights IS
  'Per-org learned AI patterns. Updated weekly by ai-learning-recalibrate Edge Function. Injected into all Claude prompts.';

-- ============ 20260605_ux_layer.sql ============
-- ============================================================
-- Conduit UX Delight Layer — DB additions
-- AI feedback learning loop + notification read tracking
-- Run: supabase db push
-- ============================================================

-- ── AI compose feedback (learning loop foundation) ────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  lead_id    uuid REFERENCES leads(id) ON DELETE SET NULL,
  field_type text NOT NULL,
  prompt_used text NOT NULL,
  ai_output  text NOT NULL,
  user_action text NOT NULL CHECK (user_action IN ('accepted','rejected','modified','ignored')),
  final_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_feedback_org" ON ai_feedback;
CREATE POLICY "ai_feedback_org" ON ai_feedback
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Notification read tracking ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_reads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           text NOT NULL,
  notification_type text NOT NULL,
  reference_id      text,
  read_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_type, reference_id)
);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_reads_org" ON notification_reads;
CREATE POLICY "notification_reads_org" ON notification_reads
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Index for notification reads lookup ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notification_reads_user
  ON notification_reads (user_id, notification_type, reference_id);

-- ── Index for uncontacted leads query (SpeedTicker) ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_uncontacted
  ON leads (org_id, stage, first_contacted_at, created_at)
  WHERE stage = 'new_inquiry' AND first_contacted_at IS NULL;

-- ── Index for today view priority queue ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_trid_deadlines
  ON leads (org_id, le_deadline, cd_deadline)
  WHERE le_deadline IS NOT NULL OR cd_deadline IS NOT NULL;

-- ── Update ai_feedback user_action default ────────────────────────────────────
-- Allow updating user_action when user accepts/rejects (not an audit log)
-- No special policy needed — governed by org_id RLS above

-- ============ 20260606_sprint2.sql ============
-- ============================================================================
-- Sprint 2 — 10 new features
-- Adapted to the real Conduit schema:
--   • org_id is uuid REFERENCES organizations(id) (NOT text)
--   • RLS uses public.get_org_id() (maps Clerk org claim -> organizations.id)
--   • Document uploads extend the existing document_requests table
--     (the borrower portal already renders document_requests)
--   • A new social_proof_posts table is used (the existing social_posts table
--     has an incompatible per-platform schema)
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1.2 — Borrower document upload (extends document_requests + storage bucket)
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS file_path        text;
ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS file_name        text;
ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS file_size_bytes  integer;
ALTER TABLE document_requests ADD COLUMN IF NOT EXISTS uploaded_at      timestamptz;

-- Private storage bucket for borrower-uploaded documents.
-- All access is via the service-role key in API routes, so no public policies.
INSERT INTO storage.buckets (id, name, public)
VALUES ('borrower-docs', 'borrower-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 2.2 — Scenario comparisons (optional save)
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenario_comparisons (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  borrower_profile jsonb NOT NULL,
  program_results  jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scenario_comparisons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scenario_comparisons_org_all" ON scenario_comparisons;
CREATE POLICY "scenario_comparisons_org_all" ON scenario_comparisons
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE INDEX IF NOT EXISTS idx_scenario_comparisons_org ON scenario_comparisons(org_id, created_at DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- 2.3 — Dialer call log
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  direction        text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone_from       text NOT NULL,
  phone_to         text NOT NULL,
  status           text NOT NULL DEFAULT 'initiated',
  duration_seconds integer NOT NULL DEFAULT 0,
  twilio_call_sid  text,
  notes            text,
  recording_url    text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE call_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_log_org_all" ON call_log;
CREATE POLICY "call_log_org_all" ON call_log
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE INDEX IF NOT EXISTS idx_call_log_org_id ON call_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_log_lead_id ON call_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_log_sid ON call_log(twilio_call_sid);

-- ──────────────────────────────────────────────────────────────────────────
-- 3.1 — Refi opportunity engine
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS original_rate         numeric(5,3);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS original_loan_amount  integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS original_loan_program text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_date           date;

CREATE TABLE IF NOT EXISTS refi_opportunities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  original_rate         numeric(5,3) NOT NULL,
  current_market_rate   numeric(5,3) NOT NULL,
  rate_spread           numeric(5,3) NOT NULL,
  monthly_savings       integer NOT NULL,
  annual_savings        integer NOT NULL,
  loan_balance_estimate integer,
  outreach_status       text NOT NULL DEFAULT 'pending'
                        CHECK (outreach_status IN ('pending','sent','responded','not_interested','converted')),
  ai_message_draft      text,
  last_checked_at       timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, lead_id)
);

ALTER TABLE refi_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refi_opportunities_org_all" ON refi_opportunities;
CREATE POLICY "refi_opportunities_org_all" ON refi_opportunities
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE INDEX IF NOT EXISTS idx_refi_opportunities_org ON refi_opportunities(org_id, monthly_savings DESC);

-- ──────────────────────────────────────────────────────────────────────────
-- 3.2 — Ghosted lead recovery
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ghost_recovery_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stage          text NOT NULL,
  days_threshold integer NOT NULL DEFAULT 14,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, stage)
);

ALTER TABLE ghost_recovery_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ghost_recovery_rules_org_all" ON ghost_recovery_rules;
CREATE POLICY "ghost_recovery_rules_org_all" ON ghost_recovery_rules
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS ghost_recovery_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  stage_when_ghosted  text NOT NULL,
  days_inactive       integer NOT NULL,
  status              text NOT NULL DEFAULT 'detected'
                      CHECK (status IN ('detected','sequence_sent','responded','converted','dismissed')),
  ai_sequence         jsonb,
  sequence_started_at timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, lead_id)
);

ALTER TABLE ghost_recovery_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ghost_recovery_queue_org_all" ON ghost_recovery_queue;
CREATE POLICY "ghost_recovery_queue_org_all" ON ghost_recovery_queue
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE INDEX IF NOT EXISTS idx_ghost_queue_org ON ghost_recovery_queue(org_id, status);

-- ──────────────────────────────────────────────────────────────────────────
-- 3.3 — Social proof automation
-- (separate table — existing social_posts has an incompatible per-platform shape)
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_review_url text;

CREATE TABLE IF NOT EXISTS social_proof_posts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id           uuid REFERENCES leads(id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'pending_review'
                    CHECK (status IN ('pending_review','approved','scheduled','published','rejected')),
  instagram_caption text,
  facebook_caption  text,
  linkedin_caption  text,
  scheduled_for     timestamptz,
  published_at      timestamptz,
  trigger_source    text NOT NULL DEFAULT 'manual',
  nps_score         integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE social_proof_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_proof_posts_org_all" ON social_proof_posts;
CREATE POLICY "social_proof_posts_org_all" ON social_proof_posts
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE INDEX IF NOT EXISTS idx_social_proof_posts_org ON social_proof_posts(org_id, status, created_at DESC);

-- ============ 20260606_sprint3_credit_repair.sql ============
-- ============================================================================
-- Sprint 3 — Consumer Credit Repair Module
-- Adapted to the real Conduit schema:
--   • org_id is uuid REFERENCES organizations(id)
--   • RLS via public.get_org_id() (LO side); borrower-portal routes use the
--     service-role admin client (bypasses RLS)
--   • reuses the existing update_updated_at() trigger function
-- ============================================================================

-- Enrollments: one per borrower who activates credit repair
CREATE TABLE IF NOT EXISTS credit_repair_enrollments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id                uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  stripe_customer_id     text,
  stripe_subscription_id text,
  subscription_status    text NOT NULL DEFAULT 'trial'
                         CHECK (subscription_status IN ('trial','active','past_due','canceled','paused')),
  trial_ends_at          timestamptz,
  billing_started_at     timestamptz,

  croa_disclosure_signed_at timestamptz,
  croa_disclosure_ip        text,
  croa_contract_text        text,

  starting_score_exp     int,
  starting_score_eqx     int,
  starting_score_tu      int,
  current_score_exp      int,
  current_score_eqx      int,
  current_score_tu       int,
  target_score           int NOT NULL DEFAULT 640,
  score_history          jsonb DEFAULT '[]',

  status                 text NOT NULL DEFAULT 'pending_upload'
                         CHECK (status IN ('pending_upload','analyzing','active','mortgage_ready','closed','canceled')),
  mortgage_ready_at      timestamptz,
  closed_at              timestamptz,
  cancel_reason          text,

  notify_score_milestone boolean DEFAULT true,
  notify_item_removed    boolean DEFAULT true,
  notify_dispute_sent    boolean DEFAULT true,
  notify_bureau_response boolean DEFAULT true,
  notify_mortgage_ready  boolean DEFAULT true,
  notify_sms             boolean DEFAULT false,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, lead_id)
);

-- Credit report pulls (one per soft-pull cycle)
CREATE TABLE IF NOT EXISTS credit_report_uploads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     uuid NOT NULL REFERENCES credit_repair_enrollments(id) ON DELETE CASCADE,
  org_id            uuid NOT NULL,
  lead_id           uuid NOT NULL,
  storage_path      text NOT NULL,
  source_bureau     text NOT NULL CHECK (source_bureau IN ('experian','equifax','transunion','tri_merge','unknown')),
  report_date       date,
  cycle_number      int NOT NULL DEFAULT 1,
  parse_status      text NOT NULL DEFAULT 'pending'
                    CHECK (parse_status IN ('pending','parsing','parsed','failed')),
  parse_error       text,
  score_exp         int,
  score_eqx         int,
  score_tu          int,
  ai_analysis       jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Tradelines extracted from a report
CREATE TABLE IF NOT EXISTS credit_tradelines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     uuid NOT NULL REFERENCES credit_repair_enrollments(id) ON DELETE CASCADE,
  report_upload_id  uuid NOT NULL REFERENCES credit_report_uploads(id) ON DELETE CASCADE,
  org_id            uuid NOT NULL,
  creditor_name     text NOT NULL,
  account_number    text,
  account_type      text,
  bureau            text NOT NULL CHECK (bureau IN ('experian','equifax','transunion','all_three')),
  balance           numeric,
  credit_limit      numeric,
  open_date         date,
  close_date        date,
  status            text,
  payment_status    text,
  negative_remarks  text[],
  is_disputable     boolean NOT NULL DEFAULT false,
  dispute_reason    text,
  dispute_priority  int DEFAULT 5,
  estimated_score_gain int,
  dispute_status    text NOT NULL DEFAULT 'identified'
                    CHECK (dispute_status IN ('identified','queued','letter_sent','verified','removed','updated','not_disputing')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Dispute letters (one per tradeline per bureau per cycle)
CREATE TABLE IF NOT EXISTS credit_disputes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id     uuid NOT NULL REFERENCES credit_repair_enrollments(id) ON DELETE CASCADE,
  tradeline_id      uuid NOT NULL REFERENCES credit_tradelines(id) ON DELETE CASCADE,
  org_id            uuid NOT NULL,
  bureau            text NOT NULL CHECK (bureau IN ('experian','equifax','transunion')),
  cycle_number      int NOT NULL DEFAULT 1,
  letter_type       text NOT NULL DEFAULT 'initial'
                    CHECK (letter_type IN ('initial','re_dispute','method_of_verification','cfpb_complaint','goodwill','pay_for_delete')),
  letter_body       text NOT NULL,
  borrower_name     text NOT NULL,
  borrower_address  text NOT NULL,
  bureau_address    text NOT NULL,
  lob_letter_id     text,
  lob_status        text,
  sent_at           timestamptz,
  expected_response_by timestamptz,
  response_status   text NOT NULL DEFAULT 'pending'
                    CHECK (response_status IN ('pending','awaiting_response','item_removed','item_updated','verified_accurate','no_response')),
  borrower_outcome  text,
  response_upload_path text,
  response_logged_at timestamptz,
  ai_next_action    text,
  auto_next_letter_id uuid REFERENCES credit_disputes(id),
  approved_by_borrower_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- LO notification log (append-only)
CREATE TABLE IF NOT EXISTS credit_repair_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  enrollment_id   uuid NOT NULL REFERENCES credit_repair_enrollments(id) ON DELETE CASCADE,
  lead_id         uuid,
  type            text NOT NULL,
  payload         jsonb,
  sent_via        text[],
  read_at         timestamptz,
  sent_at         timestamptz NOT NULL DEFAULT now()
);

-- Org-level notification settings
CREATE TABLE IF NOT EXISTS credit_repair_org_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  notify_score_milestones int[] DEFAULT '{580,620,640,680,720}',
  notify_on_item_removed boolean DEFAULT true,
  notify_on_dispute_sent boolean DEFAULT false,
  notify_on_bureau_response boolean DEFAULT true,
  notify_sms_default     boolean DEFAULT false,
  lo_email_override      text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE credit_repair_enrollments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_report_uploads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_tradelines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_disputes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_repair_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_repair_org_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cr_enrollments_org_all" ON credit_repair_enrollments;
CREATE POLICY "cr_enrollments_org_all" ON credit_repair_enrollments
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cr_uploads_org_all" ON credit_report_uploads;
CREATE POLICY "cr_uploads_org_all" ON credit_report_uploads
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cr_tradelines_org_all" ON credit_tradelines;
CREATE POLICY "cr_tradelines_org_all" ON credit_tradelines
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cr_disputes_org_all" ON credit_disputes;
CREATE POLICY "cr_disputes_org_all" ON credit_disputes
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cr_settings_org_all" ON credit_repair_org_settings;
CREATE POLICY "cr_settings_org_all" ON credit_repair_org_settings
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- Notifications: append-only audit trail (read scoped to org)
DROP POLICY IF EXISTS "cr_notifications_read_org" ON credit_repair_notifications;
CREATE POLICY "cr_notifications_read_org" ON credit_repair_notifications
  FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cr_notifications_insert" ON credit_repair_notifications;
CREATE POLICY "cr_notifications_insert" ON credit_repair_notifications
  FOR INSERT WITH CHECK (org_id = public.get_org_id());
-- (borrower-portal routes insert notifications via the service-role admin client,
--  which bypasses RLS — so no permissive public insert policy is exposed.)

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cr_enrollments_lead ON credit_repair_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_cr_enrollments_org ON credit_repair_enrollments(org_id);
CREATE INDEX IF NOT EXISTS idx_cr_tradelines_enrollment ON credit_tradelines(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_cr_disputes_enrollment ON credit_disputes(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_cr_disputes_awaiting ON credit_disputes(response_status) WHERE response_status = 'awaiting_response';
CREATE INDEX IF NOT EXISTS idx_cr_notifications_org ON credit_repair_notifications(org_id, sent_at DESC);

-- ── updated_at triggers (reuse existing update_updated_at()) ─────────────────
DROP TRIGGER IF EXISTS trg_cr_enrollments_updated_at ON credit_repair_enrollments;
CREATE TRIGGER trg_cr_enrollments_updated_at BEFORE UPDATE ON credit_repair_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_cr_disputes_updated_at ON credit_disputes;
CREATE TRIGGER trg_cr_disputes_updated_at BEFORE UPDATE ON credit_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_cr_settings_updated_at ON credit_repair_org_settings;
CREATE TRIGGER trg_cr_settings_updated_at BEFORE UPDATE ON credit_repair_org_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Storage bucket for borrower-uploaded bureau response letters ─────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('bureau-responses', 'bureau-responses', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
