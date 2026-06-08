-- ============================================================
-- AshleyIQ v2 — Wave 1
-- Phase 5.1 (AI condition satisfaction) + Phase 1.2 (lead score factors)
-- 2026-06-08 · idempotent · safe to re-run
-- ============================================================
BEGIN;

-- ── 1.2 — persist score factors alongside existing ai_score / ai_score_updated_at ──
-- (We extend the EXISTING ai_score mechanism rather than adding parallel `score`
--  columns the v2 prompt assumed. leads already has ai_score + ai_score_updated_at.)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_score_factors jsonb;

-- ── Append-only guard for audit tables ───────────────────────────────────────
-- Blocks UPDATE/DELETE on audit rows even for the service_role (RLS alone can't,
-- since service_role bypasses RLS). Reusable by every audit table in later phases.
CREATE OR REPLACE FUNCTION public.deny_mutation() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'append-only table %: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$fn$;

-- ── 5.1 — condition_events audit trail (INSERT-only) ──────────────────────────
CREATE TABLE IF NOT EXISTS condition_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id              uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  condition_id         uuid REFERENCES loan_conditions(id) ON DELETE SET NULL,
  document_request_id  uuid REFERENCES document_requests(id) ON DELETE SET NULL,
  actor_type           text NOT NULL CHECK (actor_type IN ('lo','processor','ai','borrower','system')),
  actor_id             uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type           text NOT NULL
                       CHECK (event_type IN ('ai_evaluated','auto_satisfied','flagged_for_review','status_changed','created','cleared')),
  model                text,
  confidence           text CHECK (confidence IN ('high','medium','low')),
  reasoning            jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE condition_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "condition_events_select" ON condition_events;
CREATE POLICY "condition_events_select" ON condition_events
  FOR SELECT USING (org_id = public.get_org_id());

DROP POLICY IF EXISTS "condition_events_insert" ON condition_events;
CREATE POLICY "condition_events_insert" ON condition_events
  FOR INSERT WITH CHECK (org_id = public.get_org_id());
-- No UPDATE / DELETE policies: non-service roles cannot mutate.

-- Append-only even for service_role:
DROP TRIGGER IF EXISTS condition_events_append_only ON condition_events;
CREATE TRIGGER condition_events_append_only
  BEFORE UPDATE OR DELETE ON condition_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE INDEX IF NOT EXISTS idx_condition_events_lead      ON condition_events(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_condition_events_condition ON condition_events(condition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_condition_events_org       ON condition_events(org_id, created_at DESC);

COMMIT;
