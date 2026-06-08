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

CREATE POLICY "cr_enrollments_org_all" ON credit_repair_enrollments
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE POLICY "cr_uploads_org_all" ON credit_report_uploads
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE POLICY "cr_tradelines_org_all" ON credit_tradelines
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE POLICY "cr_disputes_org_all" ON credit_disputes
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE POLICY "cr_settings_org_all" ON credit_repair_org_settings
  FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- Notifications: append-only audit trail (read scoped to org)
CREATE POLICY "cr_notifications_read_org" ON credit_repair_notifications
  FOR SELECT USING (org_id = public.get_org_id());
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
