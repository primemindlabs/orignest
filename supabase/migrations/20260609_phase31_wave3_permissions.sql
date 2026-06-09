-- ============================================================
-- Ashley IQ — Phase 31 · Wave 3: Extended Permission Model
-- 2026-06-09
--
-- New roles (loa, processor, compliance_officer) need NO enum change —
-- profiles.role is text. New token-gated party: title agent. New internal
-- assignment tables for LOA + processor scoping.
--
-- Real schema: users -> profiles; tenant_id -> org_id; get_org_id() RLS.
-- App-layer scoping (admin client) is enforced via lib/permissions/accessMatrix
-- + scopeLeadQuery — the spec's auth.uid() RLS doesn't apply (Clerk auth).
-- ============================================================

-- Title agent portal (token-gated; CD + wire + checklist ONLY).
CREATE TABLE IF NOT EXISTS portal_title_agents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  company_name    text NOT NULL,
  email           text NOT NULL,
  phone           text,
  token           text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  approved_by_lo  boolean NOT NULL DEFAULT false,
  approved_at     timestamptz,
  revoked         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pta_lead ON portal_title_agents(lead_id, org_id);
CREATE INDEX IF NOT EXISTS idx_pta_token ON portal_title_agents(token);
ALTER TABLE portal_title_agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pta_select" ON portal_title_agents;
CREATE POLICY "pta_select" ON portal_title_agents FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "pta_write" ON portal_title_agents;
CREATE POLICY "pta_write" ON portal_title_agents FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- Wire the deferred FK from Wave 1.
DO $$ BEGIN
  ALTER TABLE loan_chat_threads
    ADD CONSTRAINT loan_chat_threads_title_agent_fk
    FOREIGN KEY (title_agent_portal_id) REFERENCES portal_title_agents(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LOA → LO assignment.
CREATE TABLE IF NOT EXISTS portal_loa_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loa_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lo_user_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  can_edit    boolean NOT NULL DEFAULT true,
  can_send_disclosures boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(loa_user_id, lo_user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_ploa_org ON portal_loa_assignments(org_id, loa_user_id);
ALTER TABLE portal_loa_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ploa_select" ON portal_loa_assignments;
CREATE POLICY "ploa_select" ON portal_loa_assignments FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ploa_write" ON portal_loa_assignments;
CREATE POLICY "ploa_write" ON portal_loa_assignments FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- Processor → explicit per-loan assignment.
CREATE TABLE IF NOT EXISTS portal_processor_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processor_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_lead_ids uuid[] NOT NULL DEFAULT '{}',
  can_order_appraisal boolean NOT NULL DEFAULT true,
  can_request_conditions boolean NOT NULL DEFAULT true,
  can_send_borrower_messages boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(processor_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_ppa_org ON portal_processor_assignments(org_id, processor_id);
ALTER TABLE portal_processor_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ppa_select" ON portal_processor_assignments;
CREATE POLICY "ppa_select" ON portal_processor_assignments FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ppa_write" ON portal_processor_assignments;
CREATE POLICY "ppa_write" ON portal_processor_assignments FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
