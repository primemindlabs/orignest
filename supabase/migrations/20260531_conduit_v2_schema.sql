-- ============================================================
-- Conduit CRM v2.0 — Full Schema + Security Hardening
-- Next.js 14 + Clerk + Supabase migration
-- Run: supabase db push
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Helper: get org_id from Clerk JWT ────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth.get_org_id() RETURNS uuid AS $$
  SELECT NULLIF(
    (auth.jwt() ->> 'org_id')::text,
    ''
  )::uuid;
$$ LANGUAGE sql STABLE;

-- ── Organizations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id          text UNIQUE NOT NULL,
  name                  text NOT NULL,
  nmls_company_id       text,
  licensed_states       text[] DEFAULT '{}',
  billing_email         text,
  subscription_plan     text NOT NULL DEFAULT 'starter'
                        CHECK (subscription_plan IN ('starter','growth','team')),
  subscription_status   text NOT NULL DEFAULT 'trialing'
                        CHECK (subscription_status IN ('trialing','active','past_due','canceled','incomplete')),
  stripe_customer_id    text,
  stripe_subscription_id text,
  trial_ends_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_own"
  ON organizations
  USING (id = auth.get_org_id())
  WITH CHECK (id = auth.get_org_id());

-- ── Profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   text UNIQUE NOT NULL,
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  first_name      text NOT NULL DEFAULT '',
  last_name       text NOT NULL DEFAULT '',
  role            text NOT NULL DEFAULT 'loan_officer'
                  CHECK (role IN ('admin','branch_manager','loan_officer','processor')),
  nmls_id         text,
  phone           text,
  avatar_url      text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_own_org"
  ON profiles
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Leads ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_to                 uuid REFERENCES profiles(id) ON DELETE SET NULL,
  stage                       text NOT NULL DEFAULT 'new_inquiry'
                              CHECK (stage IN (
                                'new_inquiry','pre_qual','application','processing',
                                'underwriting','conditional_approval','clear_to_close',
                                'closed','declined','withdrawn'
                              )),

  -- Borrower identity
  first_name                  text NOT NULL,
  last_name                   text NOT NULL,
  email                       text NOT NULL,
  phone                       text,
  date_of_birth               text,  -- encrypted at application layer

  -- TCPA / consent
  sms_consent                 boolean NOT NULL DEFAULT false,
  sms_consent_obtained_at     timestamptz,
  sms_consent_ip              text,
  sms_consent_text            text,
  unsubscribed_email          boolean NOT NULL DEFAULT false,
  unsubscribed_at             timestamptz,

  -- PII (AES-256-GCM encrypted — see lib/compliance/encryption.ts)
  ssn_encrypted               text,
  ssn_iv                      text,
  income_encrypted            text,
  income_iv                   text,
  credit_score                integer CHECK (credit_score BETWEEN 300 AND 850),

  -- Loan details
  loan_type                   text CHECK (loan_type IN (
                                'conventional','fha','va','usda','jumbo',
                                'non_qm','heloc','construction','reverse','commercial','dscr'
                              )),
  loan_purpose                text CHECK (loan_purpose IN (
                                'purchase','rate_term_refinance','cash_out_refinance','heloc','construction'
                              )),
  loan_amount                 numeric(14,2),
  property_address            text,
  property_city               text,
  property_state              char(2),
  property_zip                text,
  property_type               text CHECK (property_type IN (
                                'single_family','condo','townhouse',
                                'multi_family_2_4','multi_family_5plus','commercial','land'
                              )),
  occupancy_type              text CHECK (occupancy_type IN (
                                'primary_residence','second_home','investment_property'
                              )),
  estimated_value             numeric(14,2),
  down_payment                numeric(14,2),
  ltv                         numeric(5,2),

  -- TRID compliance (calculated and stored for performance)
  application_submitted_at    timestamptz,
  le_deadline                 date,
  loan_estimate_sent_at       timestamptz,
  intent_to_proceed_at        timestamptz,
  cd_deadline                 date,
  closing_disclosure_sent_at  timestamptz,
  closing_date                date,

  -- AI scoring
  ai_score                    smallint CHECK (ai_score BETWEEN 0 AND 100),
  ai_score_updated_at         timestamptz,
  pipeline_value              numeric(14,2),

  -- Source tracking
  lead_source                 text,
  referral_partner_id         uuid REFERENCES referral_partners(id) ON DELETE SET NULL,
  utm_source                  text,
  utm_medium                  text,
  utm_campaign                text,

  -- Engagement
  first_contacted_at          timestamptz,
  last_contacted_at           timestamptz,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_org_stage    ON leads(org_id, stage);
CREATE INDEX IF NOT EXISTS idx_leads_org_assigned ON leads(org_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_org_created  ON leads(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_speed        ON leads(org_id, created_at) WHERE first_contacted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_trid_le      ON leads(org_id, le_deadline) WHERE loan_estimate_sent_at IS NULL;

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_org" ON leads
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Lead Notes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id),
  content     text NOT NULL,
  is_private  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_org" ON lead_notes
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Lead Tasks ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title       text NOT NULL,
  description text,
  due_date    timestamptz,
  completed   boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  priority    text NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high','urgent')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_org" ON lead_tasks
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Lead Activities ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  description text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id, created_at DESC);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activities_org" ON lead_activities
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Documents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by     uuid NOT NULL REFERENCES profiles(id),
  document_type   text NOT NULL,
  file_name       text NOT NULL,
  file_size       integer NOT NULL,
  mime_type       text NOT NULL,
  storage_path    text NOT NULL,
  ai_extracted    boolean NOT NULL DEFAULT false,
  ai_summary      text,
  verified        boolean NOT NULL DEFAULT false,
  verified_by     uuid REFERENCES profiles(id),
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_org" ON documents
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Communications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communications (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id                 uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id               uuid NOT NULL REFERENCES profiles(id),
  channel                 text NOT NULL CHECK (channel IN ('email','sms','call','note')),
  direction               text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  subject                 text,
  body                    text NOT NULL,
  sent_at                 timestamptz,
  delivered_at            timestamptz,
  opened_at               timestamptz,
  consent_status_at_send  boolean NOT NULL DEFAULT false,
  resend_message_id       text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comms_org" ON communications
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Referral Partners ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_partners (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  added_by        uuid NOT NULL REFERENCES profiles(id),
  type            text NOT NULL CHECK (type IN ('realtor','builder','cpa','attorney','financial_advisor','other')),
  company_name    text NOT NULL,
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text NOT NULL,
  phone           text,
  license_number  text,
  website         text,
  notes           text,
  referral_count  integer NOT NULL DEFAULT 0,
  closed_count    integer NOT NULL DEFAULT 0,
  total_volume    numeric(14,2) NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referral_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners_org" ON referral_partners
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Campaigns ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  name            text NOT NULL,
  description     text,
  type            text NOT NULL DEFAULT 'drip' CHECK (type IN ('drip','blast','nurture')),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  trigger_stage   text,
  total_steps     integer NOT NULL DEFAULT 0,
  enrolled_count  integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_org" ON campaigns
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Campaign Steps ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_steps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  channel     text NOT NULL CHECK (channel IN ('email','sms','call','note')),
  delay_days  integer NOT NULL DEFAULT 0,
  delay_hours integer NOT NULL DEFAULT 0,
  subject     text,
  body        text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "steps_org" ON campaign_steps
  USING (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- ── Audit Events (APPEND-ONLY — no UPDATE, no DELETE) ─────────────────────────
CREATE TABLE IF NOT EXISTS audit_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id      text NOT NULL,
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   text,
  before_state  jsonb,
  after_state   jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_org  ON audit_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_events(actor_id, created_at DESC);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
-- INSERT only — no UPDATE policy, no DELETE policy (append-only)
CREATE POLICY "audit_insert" ON audit_events FOR INSERT
  WITH CHECK (org_id = auth.get_org_id());
CREATE POLICY "audit_select" ON audit_events FOR SELECT
  USING (org_id = auth.get_org_id());
-- Explicitly block updates and deletes via RLS (belt+suspenders)
CREATE POLICY "audit_no_update" ON audit_events FOR UPDATE USING (false);
CREATE POLICY "audit_no_delete" ON audit_events FOR DELETE USING (false);

-- ── PII Access Log (APPEND-ONLY) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pii_access_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES organizations(id) ON DELETE CASCADE,
  accessor_id     text NOT NULL,
  lead_id         uuid REFERENCES leads(id) ON DELETE CASCADE,
  fields_accessed text[] NOT NULL,
  purpose         text NOT NULL,
  ip_address      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pii_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pii_log_insert" ON pii_access_log FOR INSERT
  WITH CHECK (org_id = auth.get_org_id());
CREATE POLICY "pii_log_select" ON pii_access_log FOR SELECT
  USING (org_id = auth.get_org_id());
CREATE POLICY "pii_log_no_update" ON pii_access_log FOR UPDATE USING (false);
CREATE POLICY "pii_log_no_delete" ON pii_access_log FOR DELETE USING (false);

-- ── TCPA Consent Log (APPEND-ONLY) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tcpa_consent_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id          uuid REFERENCES leads(id) ON DELETE CASCADE,
  channel          text NOT NULL CHECK (channel IN ('sms','call','email')),
  consent_given    boolean NOT NULL,
  consent_method   text NOT NULL DEFAULT 'verbal'
                   CHECK (consent_method IN ('web_form','verbal','written','opt_in_text')),
  consent_language text NOT NULL,
  ip_address       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tcpa_consent_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tcpa_insert" ON tcpa_consent_log FOR INSERT
  WITH CHECK (org_id = auth.get_org_id());
CREATE POLICY "tcpa_select" ON tcpa_consent_log FOR SELECT
  USING (org_id = auth.get_org_id());
CREATE POLICY "tcpa_no_update" ON tcpa_consent_log FOR UPDATE USING (false);
CREATE POLICY "tcpa_no_delete" ON tcpa_consent_log FOR DELETE USING (false);

-- ── Rate Limits (service-role only) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      text NOT NULL,
  action       text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  count        integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, action, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits ON rate_limits(user_id, action, window_start);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- Service role only — all user-level access blocked
CREATE POLICY "rate_limits_deny_all" ON rate_limits USING (false) WITH CHECK (false);

-- ── MFA Status ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mfa_status (
  clerk_user_id text PRIMARY KEY,
  org_id        uuid REFERENCES organizations(id),
  mfa_enabled   boolean NOT NULL DEFAULT false,
  last_verified timestamptz,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE mfa_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mfa_self" ON mfa_status
  USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- ── Updated-at triggers ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','profiles','leads','lead_notes','lead_tasks','referral_partners','campaigns'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ── Finalize ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE audit_events IS 'Append-only GLBA/ECOA compliance audit log. No UPDATE or DELETE ever.';
COMMENT ON TABLE tcpa_consent_log IS 'Append-only TCPA consent records. Required for regulatory defense.';
COMMENT ON TABLE pii_access_log IS 'Append-only log of every PII field decryption event.';
