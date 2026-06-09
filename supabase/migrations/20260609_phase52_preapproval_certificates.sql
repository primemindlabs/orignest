-- Phase 52.1 — shareable pre-approval certificate. Real schema: tenants->organizations,
-- users->profiles. No SSN/DOB. token_hash = SHA-256 of a random token.
CREATE TABLE IF NOT EXISTS pre_approval_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  approved_amount numeric(12,2) NOT NULL, loan_type text NOT NULL, property_type text,
  expiration_date date NOT NULL,
  lo_name text NOT NULL, lo_nmls text, company_name text NOT NULL, company_nmls text,
  lo_phone text, lo_email text, lo_headshot_url text,
  is_revoked boolean NOT NULL DEFAULT false, revoked_at timestamptz, revoked_reason text,
  view_count integer NOT NULL DEFAULT 0, last_viewed_at timestamptz,
  created_by uuid REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pac_lead ON pre_approval_certificates(lead_id, created_at DESC);
ALTER TABLE pre_approval_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pac_tenant" ON pre_approval_certificates;
CREATE POLICY "pac_tenant" ON pre_approval_certificates FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
