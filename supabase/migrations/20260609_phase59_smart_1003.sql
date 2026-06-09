-- Phase 59 — Smart 1003 (URLA). Real schema: loans=leads, users=profiles.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS application_completeness_score numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS application_blocking_conditions text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS application_last_ai_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS application_ai_review_result jsonb;
CREATE TABLE IF NOT EXISTS declaration_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_name text NOT NULL, old_value text, new_value text,
  changed_by uuid REFERENCES profiles(id), changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decl_log_lead ON declaration_change_log(lead_id, changed_at DESC);
ALTER TABLE declaration_change_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dcl_select" ON declaration_change_log;
CREATE POLICY "dcl_select" ON declaration_change_log FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "dcl_insert" ON declaration_change_log;
CREATE POLICY "dcl_insert" ON declaration_change_log FOR INSERT WITH CHECK (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON declaration_change_log FROM PUBLIC, authenticated, service_role, anon;
