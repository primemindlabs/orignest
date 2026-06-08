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

CREATE POLICY "social_proof_posts_org_all" ON social_proof_posts
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE INDEX IF NOT EXISTS idx_social_proof_posts_org ON social_proof_posts(org_id, status, created_at DESC);
