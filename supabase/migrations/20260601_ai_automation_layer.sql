-- ============================================================
-- Orignest — AI Automation Layer
-- 2026-06-01
-- ============================================================

-- ============================================================
-- HELPER: get_org_id() — returns the authenticated org UUID
-- Mirrors the pattern used in existing tables
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT id FROM organizations
    WHERE clerk_org_id = (
      SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
    )
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- AI AGENT RUNS (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID REFERENCES organizations(id) ON DELETE CASCADE,
  agent_type        TEXT NOT NULL CHECK (agent_type IN (
    'morning_briefing','speed_to_contact','rate_watch','document_chase',
    'deal_analysis','partner_nurture','lead_score','trid_monitor',
    'post_close_retention','hmda_prefill','compliance_scan'
  )),
  status            TEXT NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running','completed','failed','skipped')),
  leads_processed   INTEGER DEFAULT 0,
  actions_taken     INTEGER DEFAULT 0,
  summary           TEXT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  metadata          JSONB
);

CREATE INDEX idx_ai_agent_runs_org_id ON ai_agent_runs(org_id, started_at DESC);
CREATE INDEX idx_ai_agent_runs_agent_type ON ai_agent_runs(agent_type, started_at DESC);
CREATE INDEX idx_ai_agent_runs_status ON ai_agent_runs(status);

ALTER TABLE ai_agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_agent_runs_org_select"
  ON ai_agent_runs FOR SELECT
  USING (org_id = public.get_org_id());

-- INSERT only — service role inserts via admin client
CREATE POLICY "ai_agent_runs_service_insert"
  ON ai_agent_runs FOR INSERT
  WITH CHECK (TRUE);

-- Append-only: revoke UPDATE and DELETE from all roles
REVOKE UPDATE ON ai_agent_runs FROM PUBLIC;
REVOKE DELETE ON ai_agent_runs FROM PUBLIC;
REVOKE UPDATE ON ai_agent_runs FROM service_role;
REVOKE DELETE ON ai_agent_runs FROM service_role;
REVOKE TRUNCATE ON ai_agent_runs FROM PUBLIC;
REVOKE TRUNCATE ON ai_agent_runs FROM service_role;

-- ============================================================
-- AUTOMATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS automations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  name            TEXT NOT NULL,
  description     TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN (
    'new_lead','stage_changed','no_contact_hours','trid_deadline_approaching',
    'rate_drop','document_overdue','anniversary','birthday','rate_lock_expiring',
    'lead_score_changed','application_submitted','closing_date_approaching'
  )),
  trigger_config  JSONB NOT NULL DEFAULT '{}',
  action_type     TEXT NOT NULL CHECK (action_type IN (
    'send_sms','send_email','create_task','assign_lead','change_stage',
    'enroll_campaign','notify_lo','notify_manager','ai_analysis','webhook'
  )),
  action_config   JSONB NOT NULL DEFAULT '{}',
  run_count       INTEGER NOT NULL DEFAULT 0,
  last_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automations_org_id ON automations(org_id);
CREATE INDEX idx_automations_org_active ON automations(org_id, active);
CREATE INDEX idx_automations_trigger_type ON automations(trigger_type) WHERE active = TRUE;

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automations_org_all"
  ON automations FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE TRIGGER trg_automations_updated_at
  BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- AUTOMATION EXECUTIONS (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS automation_executions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id   UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('success','failed','skipped')),
  action_taken    TEXT NOT NULL,
  result          JSONB,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_executions_automation ON automation_executions(automation_id, executed_at DESC);
CREATE INDEX idx_automation_executions_org ON automation_executions(org_id, executed_at DESC);
CREATE INDEX idx_automation_executions_lead ON automation_executions(lead_id);

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_executions_org_select"
  ON automation_executions FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "automation_executions_service_insert"
  ON automation_executions FOR INSERT
  WITH CHECK (TRUE);

-- Append-only
REVOKE UPDATE ON automation_executions FROM PUBLIC;
REVOKE DELETE ON automation_executions FROM PUBLIC;
REVOKE UPDATE ON automation_executions FROM service_role;
REVOKE DELETE ON automation_executions FROM service_role;
REVOKE TRUNCATE ON automation_executions FROM PUBLIC;
REVOKE TRUNCATE ON automation_executions FROM service_role;

-- ============================================================
-- MORNING BRIEFINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS morning_briefings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id               UUID REFERENCES profiles(id) ON DELETE CASCADE,
  briefing_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  summary             TEXT NOT NULL,
  priority_leads      JSONB NOT NULL DEFAULT '[]',
  trid_alerts         JSONB NOT NULL DEFAULT '[]',
  rate_watch_alerts   JSONB NOT NULL DEFAULT '[]',
  tasks_due           JSONB NOT NULL DEFAULT '[]',
  pipeline_stats      JSONB NOT NULL DEFAULT '{}',
  delivered_at        TIMESTAMPTZ,
  read_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, lo_id, briefing_date)
);

CREATE INDEX idx_morning_briefings_org_lo ON morning_briefings(org_id, lo_id, briefing_date DESC);

ALTER TABLE morning_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "morning_briefings_org_select"
  ON morning_briefings FOR SELECT
  USING (org_id = public.get_org_id());

CREATE POLICY "morning_briefings_service_upsert"
  ON morning_briefings FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "morning_briefings_service_update"
  ON morning_briefings FOR UPDATE
  USING (TRUE);

-- ============================================================
-- RATE WATCH
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_watch (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  watch_type            TEXT NOT NULL CHECK (watch_type IN ('refi_opportunity','rate_lock_alert','market_update')),
  trigger_rate_threshold NUMERIC(5,3),
  current_rate          NUMERIC(5,3),
  original_rate         NUMERIC(5,3),
  original_loan_amount  NUMERIC(14,2),
  monthly_savings       NUMERIC(10,2),
  alert_sent            BOOLEAN NOT NULL DEFAULT FALSE,
  alert_sent_at         TIMESTAMPTZ,
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_watch_org_id ON rate_watch(org_id);
CREATE INDEX idx_rate_watch_lead_id ON rate_watch(lead_id);
CREATE INDEX idx_rate_watch_active ON rate_watch(org_id, active) WHERE active = TRUE;

ALTER TABLE rate_watch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_watch_org_all"
  ON rate_watch FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- PARTNER PORTAL TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS partner_portal_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  partner_id      UUID NOT NULL REFERENCES referral_partners(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  last_accessed_at TIMESTAMPTZ,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partner_portal_tokens_token ON partner_portal_tokens(token) WHERE active = TRUE;
CREATE INDEX idx_partner_portal_tokens_org ON partner_portal_tokens(org_id);
CREATE INDEX idx_partner_portal_tokens_partner ON partner_portal_tokens(partner_id);

ALTER TABLE partner_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_portal_tokens_org_all"
  ON partner_portal_tokens FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- Allow service_role to access tokens for public portal validation
CREATE POLICY "partner_portal_tokens_service_select"
  ON partner_portal_tokens FOR SELECT
  USING (TRUE);

-- ============================================================
-- BORROWER PORTAL TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS borrower_portal_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '180 days'),
  last_accessed_at TIMESTAMPTZ,
  page_views      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_borrower_portal_tokens_token ON borrower_portal_tokens(token);
CREATE INDEX idx_borrower_portal_tokens_org ON borrower_portal_tokens(org_id);
CREATE INDEX idx_borrower_portal_tokens_lead ON borrower_portal_tokens(lead_id);

ALTER TABLE borrower_portal_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "borrower_portal_tokens_org_all"
  ON borrower_portal_tokens FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE POLICY "borrower_portal_tokens_service_select"
  ON borrower_portal_tokens FOR SELECT
  USING (TRUE);

CREATE POLICY "borrower_portal_tokens_service_update"
  ON borrower_portal_tokens FOR UPDATE
  USING (TRUE);

-- ============================================================
-- WIDGET TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS widget_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           UUID REFERENCES profiles(id) ON DELETE CASCADE,
  token           TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  custom_branding JSONB,
  leads_captured  INTEGER NOT NULL DEFAULT 0,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_widget_tokens_token ON widget_tokens(token) WHERE active = TRUE;
CREATE INDEX idx_widget_tokens_org ON widget_tokens(org_id);

ALTER TABLE widget_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "widget_tokens_org_all"
  ON widget_tokens FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE POLICY "widget_tokens_service_select"
  ON widget_tokens FOR SELECT
  USING (TRUE);

CREATE POLICY "widget_tokens_service_update"
  ON widget_tokens FOR UPDATE
  USING (TRUE);

-- ============================================================
-- HMDA DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS hmda_data (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id               UUID UNIQUE NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- HMDA required fields
  action_taken          TEXT,
  action_taken_date     DATE,
  ethnicity_1           TEXT,
  race_1                TEXT,
  sex                   TEXT,
  age_applicant         TEXT,
  income                TEXT,
  purchaser_type        TEXT,
  rate_spread           NUMERIC(5,3),
  hoepa_status          TEXT,
  lien_status           TEXT,
  denial_reason_1       TEXT,
  -- AI pre-fill metadata
  ai_prefilled          BOOLEAN NOT NULL DEFAULT FALSE,
  ai_prefilled_at       TIMESTAMPTZ,
  ai_confidence         JSONB,
  manually_reviewed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hmda_data_org_id ON hmda_data(org_id);
CREATE INDEX idx_hmda_data_lead_id ON hmda_data(lead_id);

ALTER TABLE hmda_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hmda_data_org_all"
  ON hmda_data FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE TRIGGER trg_hmda_data_updated_at
  BEFORE UPDATE ON hmda_data
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- LO PERFORMANCE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lo_performance_snapshots (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id                       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date               DATE NOT NULL DEFAULT CURRENT_DATE,
  leads_in_pipeline           INTEGER NOT NULL DEFAULT 0,
  leads_closed_mtd            INTEGER NOT NULL DEFAULT 0,
  volume_closed_mtd           NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_speed_to_contact_minutes INTEGER,
  trid_compliance_rate        NUMERIC(5,2),
  conversion_rate             NUMERIC(5,2),
  avg_days_to_close           INTEGER,
  referrals_received_mtd      INTEGER NOT NULL DEFAULT 0,
  ai_score_avg                NUMERIC(4,1),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, lo_id, snapshot_date)
);

CREATE INDEX idx_lo_performance_org ON lo_performance_snapshots(org_id, snapshot_date DESC);
CREATE INDEX idx_lo_performance_lo ON lo_performance_snapshots(lo_id, snapshot_date DESC);

ALTER TABLE lo_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lo_performance_org_select"
  ON lo_performance_snapshots FOR SELECT
  USING (org_id = public.get_org_id());

-- Service role only writes (edge function)
CREATE POLICY "lo_performance_service_upsert"
  ON lo_performance_snapshots FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "lo_performance_service_update"
  ON lo_performance_snapshots FOR UPDATE
  USING (TRUE);

-- ============================================================
-- ORG AI CONFIG — per-org toggle for each system agent
-- ============================================================
CREATE TABLE IF NOT EXISTS org_ai_config (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  morning_briefing_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  speed_to_contact_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  rate_watch_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  trid_monitor_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  document_chase_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  deal_analysis_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  partner_nurture_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  post_close_retention_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  lead_scoring_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE org_ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_ai_config_org_all"
  ON org_ai_config FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE TRIGGER trg_org_ai_config_updated_at
  BEFORE UPDATE ON org_ai_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- DOCUMENT REQUESTS (separate from documents table for chase logic)
-- ============================================================
CREATE TABLE IF NOT EXISTS document_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  doc_type        TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested','uploaded','verified','rejected')),
  due_date        DATE,
  reminders_sent  INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_requests_lead ON document_requests(lead_id);
CREATE INDEX idx_document_requests_org ON document_requests(org_id);
CREATE INDEX idx_document_requests_status ON document_requests(org_id, status);

ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_requests_org_all"
  ON document_requests FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

CREATE TRIGGER trg_document_requests_updated_at
  BEFORE UPDATE ON document_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RATE LIMITS (for AI API endpoints — used by coach and new routes)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  action        TEXT NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  count         INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, action, window_start)
);

CREATE INDEX idx_rate_limits_user_action ON rate_limits(user_id, action, window_start DESC);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_service_only"
  ON rate_limits FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);
