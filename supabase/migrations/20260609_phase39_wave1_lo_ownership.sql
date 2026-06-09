-- ============================================================
-- Ashley IQ — Phase 39 · Wave 1: LO Data Ownership
-- 2026-06-09 — Real schema: tenants->organizations, users->profiles,
-- assigned_lo_id->assigned_to.
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS data_ownership text NOT NULL DEFAULT 'company_generated'
    CHECK (data_ownership IN ('lo_personal','company_generated','company_referral')),
  ADD COLUMN IF NOT EXISTS ownership_notes text;
CREATE INDEX IF NOT EXISTS leads_lo_personal_idx ON leads(assigned_to, data_ownership) WHERE data_ownership = 'lo_personal';

CREATE TABLE IF NOT EXISTS data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES profiles(id),
  export_type text NOT NULL CHECK (export_type IN ('lo_personal_book','full_lead_data','ccpa')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed')),
  record_count integer,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_der_org ON data_export_requests(org_id, created_at DESC);
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "der_select" ON data_export_requests;
CREATE POLICY "der_select" ON data_export_requests FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "der_insert" ON data_export_requests;
CREATE POLICY "der_insert" ON data_export_requests FOR INSERT WITH CHECK (org_id = public.get_org_id());
DROP POLICY IF EXISTS "der_update" ON data_export_requests;
CREATE POLICY "der_update" ON data_export_requests FOR UPDATE USING (org_id = public.get_org_id());
REVOKE DELETE, TRUNCATE ON data_export_requests FROM PUBLIC, authenticated, service_role, anon;
