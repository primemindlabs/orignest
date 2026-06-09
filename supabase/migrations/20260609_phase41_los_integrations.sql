-- ============================================================
-- Ashley IQ — Phase 41: LOS Integration Hub (LendingPad + Arive)
-- 2026-06-09 — Real schema: tenants->organizations. No loan_files table —
-- loans are `leads`, so los_loan_map links to leads.
-- ============================================================

CREATE TABLE IF NOT EXISTS los_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  los_type text NOT NULL CHECK (los_type IN ('lendingpad','arive','encompass','byte')),
  api_key_enc text, api_secret_enc text, webhook_secret text, base_url text,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz, sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, los_type)
);
ALTER TABLE los_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "los_conn_tenant" ON los_connections;
CREATE POLICY "los_conn_tenant" ON los_connections FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS los_loan_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  los_type text NOT NULL, los_loan_id text NOT NULL,
  ashley_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  sync_direction text NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('los_to_iq','iq_to_los','bidirectional')),
  last_synced_at timestamptz, sync_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, los_type, los_loan_id)
);
CREATE INDEX IF NOT EXISTS idx_llm_lead ON los_loan_map(ashley_lead_id);
ALTER TABLE los_loan_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "llm_tenant" ON los_loan_map;
CREATE POLICY "llm_tenant" ON los_loan_map FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS los_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  los_type text NOT NULL, los_loan_id text, event_type text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  payload jsonb, result text, error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lse_org ON los_sync_events(org_id, created_at DESC);
ALTER TABLE los_sync_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lse_select" ON los_sync_events;
CREATE POLICY "lse_select" ON los_sync_events FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "lse_insert" ON los_sync_events;
CREATE POLICY "lse_insert" ON los_sync_events FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON los_sync_events FROM PUBLIC, authenticated, service_role, anon;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS los_loan_id text,
  ADD COLUMN IF NOT EXISTS los_type text,
  ADD COLUMN IF NOT EXISTS los_last_synced_at timestamptz;
