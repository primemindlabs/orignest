-- Phase 75 — Dashboard goal ring.
-- Per-LO monthly funded-volume target, used by the immersive dashboard GoalRing.
-- Additive + idempotent. Already applied to prod (project dhnxiijduycmzfjmohyp) via MCP.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS monthly_volume_goal NUMERIC(12,2) DEFAULT 4000000.00;

COMMENT ON COLUMN profiles.monthly_volume_goal IS 'LO monthly funded volume target in dollars (Phase 75 dashboard goal ring)';
