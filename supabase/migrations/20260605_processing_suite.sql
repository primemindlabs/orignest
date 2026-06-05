-- ============================================================
-- Conduit CRM — Processing Suite Migration
-- Features: Conditions, Milestones, Closing Checklist,
--           Cross-Tenant Processor, AI Learning Loop
-- ============================================================

-- ── Helper alias (public schema) ─────────────────────────────────────────────
-- Mirrors auth.get_org_id() so policies can use public.get_org_id()
CREATE OR REPLACE FUNCTION public.get_org_id() RETURNS uuid AS $$
  SELECT NULLIF(
    (auth.jwt() ->> 'org_id')::text,
    ''
  )::uuid;
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
CREATE POLICY "processor_assignments_org" ON processor_assignments
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());
-- Processors can read their own assignments (cross-org)
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
CREATE POLICY "pfa_org" ON processor_file_assignments
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());
-- Processors read their own file assignments (cross-org — the ONLY cross-tenant query)
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
