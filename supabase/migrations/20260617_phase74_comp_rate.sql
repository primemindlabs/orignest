-- Phase 74 — per-LO commission rate (on profile) for pipeline commission estimates.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS comp_rate NUMERIC(5,3) DEFAULT 0.500;
