-- ============================================================
-- Ashley IQ — Phase 50: Full Mortgage Business OS (foundation)
-- 2026-06-09 — Real schema: tenants->organizations, users->profiles.
-- comp_plans + commissions already exist; this adds channel + licensing + HMDA.
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS channel text DEFAULT 'broker' CHECK (channel IN ('broker','direct_lender','correspondent','bank_credit_union','independent_lo')),
  ADD COLUMN IF NOT EXISTS business_settings jsonb NOT NULL DEFAULT '{"has_branch_manager":true,"has_brand_manager":false,"multiple_branches":false,"uses_wholesale_lenders":true,"has_in_house_uw":false,"has_servicing":false}'::jsonb;

CREATE TABLE IF NOT EXISTS lo_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nmls_id text, state char(2) NOT NULL, license_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended','pending_renewal','expired')),
  issue_date date, expiry_date date NOT NULL, auto_renew boolean DEFAULT false, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, state)
);
CREATE INDEX IF NOT EXISTS idx_lol_user ON lo_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_lol_expiry ON lo_licenses(org_id, expiry_date) WHERE status = 'active';
ALTER TABLE lo_licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lol_tenant" ON lo_licenses;
CREATE POLICY "lol_tenant" ON lo_licenses FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS hmda_reportable boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS hmda_action_taken text CHECK (hmda_action_taken IN ('originated','approved_not_accepted','denied','withdrawn','incomplete','purchased')),
  ADD COLUMN IF NOT EXISTS hmda_preapproval text CHECK (hmda_preapproval IN ('requested','not_requested'));
