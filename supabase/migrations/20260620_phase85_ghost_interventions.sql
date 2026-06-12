-- Phase 85 — ghost re-engagement interventions (TCPA compliance audit trail).
-- Rows are created as AI drafts, then updated once with the human-reviewed send.
-- Adapted: org_id uuid + user_id/sent_by -> profiles(id) (Clerk auth), get_org_id() RLS.
--
-- NOTE: the spec's `borrower_engagement_scores` (0–10) table is intentionally NOT created —
-- it would duplicate the existing `borrower_behavior_scores` (0–100 engagement). The 0–10
-- ghost score is computed on demand (lib/ghost) from real signals.

CREATE TABLE IF NOT EXISTS ghost_interventions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  intervention_type     TEXT NOT NULL CHECK (intervention_type IN ('sms','email','call_attempt')),
  ghost_score           INT,
  band                  TEXT,
  suggested_message     TEXT NOT NULL,
  edited_message        TEXT,
  tcpa_acknowledged     BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at               TIMESTAMPTZ,
  sent_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  transmitted           BOOLEAN NOT NULL DEFAULT FALSE,
  response_received_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ghost_interventions_lead ON ghost_interventions (lead_id, created_at DESC);

ALTER TABLE ghost_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ghost_interventions_org_select" ON ghost_interventions
  FOR SELECT USING (org_id = public.get_org_id());
CREATE POLICY "ghost_interventions_service_insert" ON ghost_interventions
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "ghost_interventions_service_update" ON ghost_interventions
  FOR UPDATE USING (TRUE);

-- Never deletable — compliance audit trail.
REVOKE DELETE, TRUNCATE ON ghost_interventions FROM PUBLIC, anon, authenticated, service_role;
