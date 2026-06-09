-- ============================================================
-- Ashley IQ — Phase 45: Staff Workflow — loan tasks
-- 2026-06-09 — Real schema: loan_files->leads, users->profiles,
-- assigned_lo_id->assigned_to. Distinct from the existing general `tasks` table.
-- loan_conditions already exists (lead_id/condition_text/category/status/...).
-- ============================================================

CREATE TABLE IF NOT EXISTS loan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  assigned_to uuid REFERENCES profiles(id),
  title text NOT NULL, description text, due_date date,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','normal','low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_on_borrower','completed','cancelled')),
  completed_at timestamptz, completed_by uuid REFERENCES profiles(id),
  requires_lo boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','checklist','condition','stage_change','system')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lt_assignee ON loan_tasks(assigned_to, status) WHERE status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_lt_lead ON loan_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_lt_due ON loan_tasks(org_id, due_date) WHERE status <> 'completed';
ALTER TABLE loan_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lt_select" ON loan_tasks;
CREATE POLICY "lt_select" ON loan_tasks FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "lt_insert" ON loan_tasks;
CREATE POLICY "lt_insert" ON loan_tasks FOR INSERT WITH CHECK (org_id = public.get_org_id());
DROP POLICY IF EXISTS "lt_update" ON loan_tasks;
CREATE POLICY "lt_update" ON loan_tasks FOR UPDATE USING (org_id = public.get_org_id());
REVOKE DELETE, TRUNCATE ON loan_tasks FROM PUBLIC, authenticated, service_role, anon;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS aus_system text,
  ADD COLUMN IF NOT EXISTS aus_result text,
  ADD COLUMN IF NOT EXISTS aus_run_date date,
  ADD COLUMN IF NOT EXISTS aus_case_file text;

CREATE OR REPLACE FUNCTION create_stage_loan_tasks()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'processing' AND OLD.stage IS DISTINCT FROM 'processing' THEN
    INSERT INTO loan_tasks (lead_id, org_id, created_by, assigned_to, title, priority, source)
    VALUES (NEW.id, NEW.org_id, NEW.assigned_to, NEW.assigned_to, 'Start processing — build file and assign vendors', 'normal', 'stage_change');
  END IF;
  IF NEW.stage = 'conditional_approval' AND OLD.stage IS DISTINCT FROM 'conditional_approval' THEN
    INSERT INTO loan_tasks (lead_id, org_id, created_by, assigned_to, title, priority, source)
    VALUES (NEW.id, NEW.org_id, NEW.assigned_to, NEW.assigned_to, 'UW conditions received — review and assign to team', 'urgent', 'stage_change');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS leads_stage_loan_tasks ON leads;
CREATE TRIGGER leads_stage_loan_tasks AFTER UPDATE OF stage ON leads FOR EACH ROW EXECUTE FUNCTION create_stage_loan_tasks();
