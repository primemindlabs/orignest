-- ============================================================
-- Ashley IQ — Phase 34 · Wave 1: Campaign Manager schema
-- 2026-06-09
--
-- EXTENDS the existing `campaigns` table (id, org_id, created_by, name,
-- description, type, status, trigger_stage, total_steps, enrolled_count) with
-- the Phase 34 library/audience columns, and adds steps/enrollments/sends/
-- analytics. The existing `campaign_sends` (Phase 30.7: draft_id/relay) is left
-- intact — Phase 34 step sends go to the new `campaign_step_sends` table.
--
-- Real schema: tenant_id -> org_id; auth.jwt() -> get_org_id(); leads has
-- closed_date (not funded_at), last_contacted_at (not last_activity_at), and no
-- date_of_birth / preapproval_expires_at (those triggers gate to empty).
-- ============================================================

-- ── Extend the PRE-EXISTING campaigns + campaign_steps + campaign_enrollments
--    tables (from an earlier drip system) for the Phase 34 library ──
ALTER TABLE campaigns ALTER COLUMN org_id DROP NOT NULL;      -- library templates: org_id NULL
ALTER TABLE campaigns ALTER COLUMN created_by DROP NOT NULL;  -- library templates: no creator
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS is_library_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS audience_criteria jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_enroll boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exit_conditions jsonb NOT NULL DEFAULT '[]';
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_type_check CHECK (type IN (
  'drip','rate_drop','milestone','birthday','loan_anniversary','home_anniversary','holiday',
  'reactivation','referral_ask','educational','market_update','pre_approval_expiring',
  'open_house_followup','custom','nurture','seasonal','equity_milestone'));
CREATE INDEX IF NOT EXISTS idx_campaigns_library ON campaigns(is_library_template, type) WHERE is_library_template = true;

-- campaign_steps already exists (cols: subject, body, active). Add Phase 34 cols
-- + allow library (org_id NULL) + 'task' channel.
ALTER TABLE campaign_steps ALTER COLUMN org_id DROP NOT NULL;
ALTER TABLE campaign_steps
  ADD COLUMN IF NOT EXISTS ai_personalize boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_personalize_instructions text,
  ADD COLUMN IF NOT EXISTS task_description text;
ALTER TABLE campaign_steps DROP CONSTRAINT IF EXISTS campaign_steps_channel_check;
ALTER TABLE campaign_steps ADD CONSTRAINT campaign_steps_channel_check CHECK (channel IN ('email','sms','task'));

-- Library templates are readable by every org (additive policy; existing
-- org-scoped policies stay in place).
DROP POLICY IF EXISTS "campaigns_library_read" ON campaigns;
CREATE POLICY "campaigns_library_read" ON campaigns FOR SELECT
  USING (is_library_template = true OR org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS campaign_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id          uuid,                       -- NULL for library steps; else owning org
  step_number     integer NOT NULL,
  delay_days      integer NOT NULL DEFAULT 0,
  delay_hours     integer NOT NULL DEFAULT 0,
  channel         text NOT NULL CHECK (channel IN ('email','sms','task')),
  subject_template text,
  body_template   text NOT NULL,
  ai_personalize  boolean NOT NULL DEFAULT true,
  ai_personalize_instructions text,
  task_description text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, step_number)
);
CREATE INDEX IF NOT EXISTS idx_cs_campaign ON campaign_steps(campaign_id, step_number);
ALTER TABLE campaign_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "csteps_access" ON campaign_steps;
CREATE POLICY "csteps_access" ON campaign_steps FOR ALL
  USING (org_id IS NULL OR org_id = public.get_org_id())
  WITH CHECK (org_id IS NULL OR org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS campaign_enrollments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrolled_by     text,                       -- Clerk user id | 'auto' | 'auto_trigger'
  enrolled_at     timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','exited','paused')),
  current_step    integer NOT NULL DEFAULT 1,
  next_send_at    timestamptz,
  exited_at       timestamptz,
  exit_reason     text,
  UNIQUE(campaign_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_ce_lead ON campaign_enrollments(lead_id, status);
CREATE INDEX IF NOT EXISTS idx_ce_next_send ON campaign_enrollments(next_send_at, status) WHERE status = 'active';
ALTER TABLE campaign_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ce_tenant" ON campaign_enrollments;
CREATE POLICY "ce_tenant" ON campaign_enrollments FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- Phase 34 immutable send audit (separate from Phase 30.7 campaign_sends).
CREATE TABLE IF NOT EXISTS campaign_step_sends (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   uuid NOT NULL REFERENCES campaign_enrollments(id) ON DELETE CASCADE,
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_id         uuid NOT NULL REFERENCES campaign_steps(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel         text NOT NULL,
  subject         text,
  body            text NOT NULL,
  original_template text NOT NULL,
  ai_personalized boolean NOT NULL DEFAULT false,
  delivery_status text NOT NULL DEFAULT 'recorded',  -- recorded | sent | skipped_tcpa | skipped_no_contact | failed
  resend_message_id text,
  twilio_message_sid text,
  sent_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_css_lead ON campaign_step_sends(lead_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_css_campaign ON campaign_step_sends(campaign_id, sent_at DESC);
ALTER TABLE campaign_step_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "css_select" ON campaign_step_sends;
CREATE POLICY "css_select" ON campaign_step_sends FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "css_insert" ON campaign_step_sends;
CREATE POLICY "css_insert" ON campaign_step_sends FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON campaign_step_sends FROM PUBLIC, authenticated, service_role, anon;

CREATE TABLE IF NOT EXISTS campaign_analytics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_date     date NOT NULL,
  enrollments_count integer NOT NULL DEFAULT 0,
  sends_count     integer NOT NULL DEFAULT 0,
  opens_count     integer NOT NULL DEFAULT 0,
  clicks_count    integer NOT NULL DEFAULT 0,
  replies_count   integer NOT NULL DEFAULT 0,
  exits_count     integer NOT NULL DEFAULT 0,
  conversions_count integer NOT NULL DEFAULT 0,
  UNIQUE(campaign_id, period_date)
);
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ca_tenant" ON campaign_analytics;
CREATE POLICY "ca_tenant" ON campaign_analytics FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
