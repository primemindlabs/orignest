-- Phase 49.7 — documents tied to UW conditions (loan_conditions exists).
CREATE TABLE IF NOT EXISTS condition_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_id uuid NOT NULL REFERENCES loan_conditions(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES profiles(id),
  file_name text NOT NULL, file_size integer, storage_path text NOT NULL, mime_type text,
  note text, is_included_in_submission boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cd_condition ON condition_documents(condition_id);
ALTER TABLE condition_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cd_tenant" ON condition_documents;
CREATE POLICY "cd_tenant" ON condition_documents FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
