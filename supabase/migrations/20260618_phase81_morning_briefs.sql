-- Phase 81 — Morning Priority Brief
-- Itemized, dismissible, deep-linking daily brief (distinct from the free-text
-- `morning_briefings` table from 20260601). One row per (org, LO, day); brief_data
-- holds an array of BriefItem objects; dismissed_items tracks per-item dismissal.
-- Schema adapted to real conventions: org_id uuid + lo_id -> profiles(id), Clerk auth,
-- public.get_org_id() RLS, service-role writes via admin client (mirrors morning_briefings).

CREATE TABLE IF NOT EXISTS morning_briefs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  brief_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  brief_data      JSONB NOT NULL DEFAULT '[]',   -- BriefItem[]
  dismissed_items TEXT[] NOT NULL DEFAULT '{}',  -- BriefItem.id values
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_version   TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, lo_id, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_morning_briefs_org_lo
  ON morning_briefs (org_id, lo_id, brief_date DESC);

ALTER TABLE morning_briefs ENABLE ROW LEVEL SECURITY;

-- Members read their org's briefs; the API additionally narrows to the caller's lo_id.
CREATE POLICY "morning_briefs_org_select"
  ON morning_briefs FOR SELECT
  USING (org_id = public.get_org_id());

-- Writes go through the service-role admin client (org/lo scoping enforced in the route).
CREATE POLICY "morning_briefs_service_insert"
  ON morning_briefs FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "morning_briefs_service_update"
  ON morning_briefs FOR UPDATE
  USING (TRUE);
