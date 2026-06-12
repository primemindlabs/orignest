-- Phase 84 — TRID event log. INSERT-ONLY immutable compliance records.
-- Adapted: org_id uuid + user_id -> profiles(id) (Clerk auth), get_org_id() RLS.
-- NOTE: the spec's `rate_lock_alerts` table is intentionally NOT created — rate-lock
-- expiry already lives in `rate_lock_expirations` (lead_id, rate, lock_expires_at,
-- lock_period_days, status); Phase 84 reads from it rather than duplicating.

CREATE TABLE IF NOT EXISTS trid_events (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id                   UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id                   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type                TEXT NOT NULL CHECK (event_type IN (
    'le_issued','le_received','le_revised',
    'cd_issued','cd_received','cd_revised',
    'rate_lock_set','rate_lock_extended','closing_date_set'
  )),
  event_date                DATE NOT NULL,
  deadline_date             DATE,
  business_days_to_deadline INT,
  is_compliant              BOOLEAN,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trid_events_lead ON trid_events (lead_id, event_date);

ALTER TABLE trid_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trid_events_org_select" ON trid_events
  FOR SELECT USING (org_id = public.get_org_id());
CREATE POLICY "trid_events_service_insert" ON trid_events
  FOR INSERT WITH CHECK (TRUE);

-- INSERT-only immutable compliance record: no UPDATE / DELETE for anyone.
REVOKE UPDATE, DELETE, TRUNCATE ON trid_events FROM PUBLIC, anon, authenticated, service_role;
