-- Phase 53 — residential income calculations (Fannie/Freddie). INSERT-only audit.
-- Real schema: tenants->organizations, users->profiles, loan_files->leads. No SSN/DOB.
CREATE TABLE IF NOT EXISTS income_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  borrower_type text NOT NULL CHECK (borrower_type IN ('primary','co_borrower')),
  income_type text NOT NULL CHECK (income_type IN ('w2_salary','w2_hourly','self_employed_sole_prop','self_employed_scorp','self_employed_partnership','rental_schedule_e','social_security','pension','bonus_commission','other_employment')),
  agency text NOT NULL DEFAULT 'both' CHECK (agency IN ('fannie','freddie','both','fha','va')),
  input_data jsonb NOT NULL,
  calculated_income numeric(12,2) NOT NULL, fannie_income numeric(12,2), freddie_income numeric(12,2),
  calculation_notes text, calculation_version text DEFAULT '1.0',
  pdf_url text, uploaded_to_condition_id uuid REFERENCES loan_conditions(id) ON DELETE SET NULL,
  calculated_by uuid REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ic_lead ON income_calculations(lead_id, created_at DESC);
ALTER TABLE income_calculations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ic_select" ON income_calculations;
CREATE POLICY "ic_select" ON income_calculations FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ic_insert" ON income_calculations;
CREATE POLICY "ic_insert" ON income_calculations FOR INSERT WITH CHECK (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON income_calculations FROM PUBLIC, authenticated, service_role, anon;
