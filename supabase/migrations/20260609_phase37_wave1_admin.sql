-- ============================================================
-- Ashley IQ — Phase 37 · Wave 1: Admin (feature flags + audit)
-- 2026-06-09 — Real schema: tenants -> organizations.
-- Both tables are platform-only (service-role); no tenant RLS access.
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  set_by text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, flag)
);
CREATE INDEX IF NOT EXISTS idx_tff_org ON tenant_feature_flags(org_id, flag);
ALTER TABLE tenant_feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tff_platform_only" ON tenant_feature_flags;
CREATE POLICY "tff_platform_only" ON tenant_feature_flags FOR ALL USING (false) WITH CHECK (false);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aal_created ON admin_audit_log(created_at DESC);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "aal_platform_only" ON admin_audit_log;
CREATE POLICY "aal_platform_only" ON admin_audit_log FOR ALL USING (false) WITH CHECK (false);
REVOKE UPDATE, DELETE, TRUNCATE ON admin_audit_log FROM PUBLIC, authenticated, service_role, anon;
REVOKE UPDATE, DELETE, TRUNCATE ON tenant_feature_flags FROM PUBLIC, authenticated, anon;
