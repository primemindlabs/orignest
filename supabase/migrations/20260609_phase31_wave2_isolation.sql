-- ============================================================
-- Ashley IQ — Phase 31 · Wave 2: Multi-LO Isolation Safeguards
-- 2026-06-09
--
-- Two LOs (orgs) competing in the same market may share borrowers/realtors.
-- Neither may ever see the other's data — or even know the other exists.
-- Base isolation is already enforced by org_id scoping + get_org_id() RLS.
-- These SECURITY DEFINER functions add anonymous cross-org awareness: they
-- look across ALL orgs but return ONLY a boolean/count — never any tenant-
-- identifying info (no name, company, LO, loan amount, or stage).
--
-- Real schema: tenant_id -> org_id; "funded"/"denied" -> 'closed'/'declined';
-- portal_realtors uses realtor_email + revoked (no is_active).
-- ============================================================

-- 31.2a — anonymous active-application detection across orgs.
CREATE OR REPLACE FUNCTION public.check_active_application(p_email text, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('has_active_elsewhere', false);
  END IF;
  SELECT count(*) INTO v_count
  FROM leads
  WHERE lower(email) = lower(trim(p_email))
    AND org_id IS DISTINCT FROM p_org_id
    AND stage NOT IN ('closed', 'withdrawn', 'declined')
    AND archived_at IS NULL
    AND created_at > now() - interval '180 days';
  -- Return ONLY the boolean. Never expose which org / LO / loan.
  RETURN jsonb_build_object('has_active_elsewhere', v_count > 0);
END; $$;
REVOKE ALL ON FUNCTION public.check_active_application(text, uuid) FROM PUBLIC;

-- 31.2b — realtor split-loyalty awareness across orgs (count only).
CREATE OR REPLACE FUNCTION public.check_realtor_other_portals(p_email text, p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('has_other_portals', false, 'portal_count', 0);
  END IF;
  SELECT count(DISTINCT org_id) INTO v_count
  FROM portal_realtors
  WHERE lower(realtor_email) = lower(trim(p_email))
    AND org_id IS DISTINCT FROM p_org_id
    AND revoked = false;
  RETURN jsonb_build_object('has_other_portals', v_count > 0, 'portal_count', v_count);
END; $$;
REVOKE ALL ON FUNCTION public.check_realtor_other_portals(text, uuid) FROM PUBLIC;

-- 31.2 — tenant_isolation_events (INSERT-only audit).
CREATE TABLE IF NOT EXISTS tenant_isolation_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type  text NOT NULL,   -- 'active_application_warning' | 'realtor_other_portals_notice' | ...
  detail      jsonb NOT NULL DEFAULT '{}',  -- NEVER store other-org identifying data
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tie_org ON tenant_isolation_events(org_id, created_at DESC);
ALTER TABLE tenant_isolation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tie_select" ON tenant_isolation_events;
CREATE POLICY "tie_select" ON tenant_isolation_events FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "tie_insert" ON tenant_isolation_events;
CREATE POLICY "tie_insert" ON tenant_isolation_events FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON tenant_isolation_events FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON tenant_isolation_events FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON tenant_isolation_events FROM service_role;
