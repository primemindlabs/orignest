-- ============================================================
-- Ashley IQ — Phase 31 · Wave 4: Additional Multi-Party Safeguards
-- 2026-06-09
--
-- LO departure log, realtor team members, document sharing controls, per-party
-- communication consent (TCPA), portal session timeout. Real schema:
-- users -> profiles; tenant_id -> org_id; portal_tokens -> borrower_portal_tokens.
-- ============================================================

-- 31.4a — LO departure / reassignment log.
CREATE TABLE IF NOT EXISTS lo_departure_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  departed_at timestamptz NOT NULL DEFAULT now(),
  loans_reassigned_to uuid REFERENCES profiles(id),
  loan_count  integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ldl_org ON lo_departure_log(org_id, departed_at DESC);
ALTER TABLE lo_departure_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ldl_select" ON lo_departure_log;
CREATE POLICY "ldl_select" ON lo_departure_log FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ldl_write" ON lo_departure_log;
CREATE POLICY "ldl_write" ON lo_departure_log FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- 31.4b — realtor team members (inherit parent portal's tier, cannot exceed it).
CREATE TABLE IF NOT EXISTS portal_realtor_team_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_realtor_id uuid NOT NULL REFERENCES portal_realtors(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  email           text NOT NULL,
  role_on_team    text NOT NULL CHECK (role_on_team IN ('lead_agent','buyers_agent','transaction_coordinator','assistant')),
  token           text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at timestamptz NOT NULL DEFAULT now() + interval '180 days',
  approved_by_lo  boolean NOT NULL DEFAULT false,
  revoked         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prtm_parent ON portal_realtor_team_members(portal_realtor_id);
CREATE INDEX IF NOT EXISTS idx_prtm_token ON portal_realtor_team_members(token);
ALTER TABLE portal_realtor_team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prtm_select" ON portal_realtor_team_members;
CREATE POLICY "prtm_select" ON portal_realtor_team_members FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "prtm_write" ON portal_realtor_team_members;
CREATE POLICY "prtm_write" ON portal_realtor_team_members FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- 31.4c — document visibility roles.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS visible_to_roles text[] NOT NULL DEFAULT ARRAY['lo','loa','processor','branch_manager'];

-- 31.4d — per-party communication consent (TCPA / CAN-SPAM).
CREATE TABLE IF NOT EXISTS communication_consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  party_type      text NOT NULL CHECK (party_type IN ('borrower','coborrower','realtor','title_agent')),
  party_identifier text NOT NULL,   -- email or phone
  sms_consent     boolean NOT NULL DEFAULT false,
  sms_consented_at timestamptz,
  sms_consent_method text,
  email_consent   boolean NOT NULL DEFAULT true,
  email_opted_out_at timestamptz,
  transactional_only boolean NOT NULL DEFAULT false,
  revoked_at      timestamptz,
  revoke_method   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cc_lookup ON communication_consents(org_id, lead_id, party_identifier);
ALTER TABLE communication_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cc_select" ON communication_consents;
CREATE POLICY "cc_select" ON communication_consents FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cc_write" ON communication_consents;
CREATE POLICY "cc_write" ON communication_consents FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- 31.4f — portal session timeout (last_accessed_at already exists).
ALTER TABLE borrower_portal_tokens
  ADD COLUMN IF NOT EXISTS session_timeout_minutes integer NOT NULL DEFAULT 60;

-- ── chat_messages is a business record (security rule: INSERT-only) ──
-- The app never edits/deletes messages; lock it append-only for audit integrity.
DROP POLICY IF EXISTS "cm_write" ON chat_messages;
DO $$ BEGIN
  CREATE POLICY "cm_insert" ON chat_messages FOR INSERT WITH CHECK (org_id = public.get_org_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE UPDATE, DELETE, TRUNCATE ON chat_messages FROM PUBLIC, authenticated, service_role, anon;
REVOKE UPDATE, DELETE, TRUNCATE ON chat_read_receipts FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON tenant_isolation_events FROM anon;
