-- Phase 80 — Profile settings. Additive only (applied live via MCP 2026-06-11).
-- Schema reality: profiles already has first_name/last_name (no full_name),
-- nmls_id (not nmls_number), avatar_url, comp_rate, monthly_volume_goal, phone,
-- email, role. The role-tiered comp / branch-template model in the original
-- spec does not apply — there is no `branches` table and roles are plain TEXT
-- (single-tenant 'admin'). comp_plans already exists from the P6 commissions
-- engine (org-scoped, bps-based) and is surfaced read-only on the comp page.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Public avatars bucket. Uploads go through the service-role admin client
-- (the RLS-bound anon client carries no Clerk token); public=true lets
-- getPublicUrl serve the image without an object policy.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
