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

CREATE POLICY "loan_applications_org"
  ON loan_applications FOR ALL
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

CREATE POLICY "nmls_licenses_org"
  ON nmls_licenses FOR ALL
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

CREATE POLICY "credit_repair_org"
  ON credit_repair_pipeline FOR ALL
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

CREATE POLICY "credit_repair_partners_org"
  ON credit_repair_partners FOR ALL
  USING  (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- EXTEND AuditAction — add new actions (comment only, enforced at app layer)
-- New values: APPLICATION_CREATED, APPLICATION_UPDATED, APPLICATION_SUBMITTED,
--             NMLS_VERIFIED, CREDIT_REPAIR_ENROLLED, CREDIT_REPAIR_SCORE_UPDATED,
--             CREDIT_REPAIR_REACTIVATED
-- ============================================================
