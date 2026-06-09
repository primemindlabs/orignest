-- ============================================================
-- Ashley IQ — Phase 36 · Wave 1: Onboarding + Invitations
-- 2026-06-09
-- Real schema: tenants -> organizations; users -> profiles; auth.jwt -> get_org_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS onboarding_progress (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  steps       jsonb NOT NULL DEFAULT '{
    "company_profile": false, "phone_number": false, "first_lead": false,
    "first_message": false, "import_contacts": false }'::jsonb,
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "onboarding_tenant" ON onboarding_progress;
CREATE POLICY "onboarding_tenant" ON onboarding_progress FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'loan_officer' CHECK (role IN ('loan_officer','lo','processor','manager','branch_manager','admin')),
  invited_by  uuid REFERENCES profiles(id),
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(org_id, created_at DESC);
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invitations_tenant" ON invitations;
CREATE POLICY "invitations_tenant" ON invitations FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
