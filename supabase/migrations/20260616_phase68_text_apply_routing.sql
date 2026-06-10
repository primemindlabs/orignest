-- Phase 68 — Text-to-Apply routing support (P61 shipped the SMS flow). Round-robin cols.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_lead_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS loan_specialties text[] DEFAULT '{}';
