-- Phase 93 — NMLS / AE client-facing gates. Most of the spec already exists (organizations
-- has name/nmls_company_id/licensed_states; profiles has nmls_id/title/avatar_url/phone;
-- lo_licenses covers per-state licensing; /settings/{profile,organization} + /getting-started
-- already built). So this adds ONLY the genuinely-new pieces: an INSERT-only NMLS change
-- audit log + an org brand_color (so white-label branding can leave the hardcoded gold).
--
-- The AE gate is computed LIVE from lender_ae_connections (count > 0) — no denormalized
-- ae_gate_passed flag, so it can never drift.

create table if not exists public.nmls_verification_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  nmls_number text not null,
  verified_by text not null default 'self_declared' check (verified_by in ('self_declared','admin_verified','nmls_registry')),
  verified_at timestamptz not null default now()
);
create index if not exists idx_nmls_verification_log_user on public.nmls_verification_log(user_id);

alter table public.nmls_verification_log enable row level security;
revoke update, delete, truncate on public.nmls_verification_log from anon, authenticated, service_role;

alter table public.organizations add column if not exists brand_color text default '#C9A95C';
