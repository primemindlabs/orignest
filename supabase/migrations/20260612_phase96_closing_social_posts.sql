-- =============================================================================
-- Phase 96 — Loan Close Social Post Generator
-- =============================================================================
-- Adapted to the real stack (Clerk, not Supabase auth):
--   * Scoped by org_id + lo_id (profiles.id), NOT auth.users. All access is via
--     the admin (service-role) client behind getOrgContext, so RLS is enabled
--     with no authenticated policy (admin-only), matching arrive_integrations /
--     realtor_heat_scores. The audit table is INSERT-only via REVOKE.
--   * The terminal lead stage in this app is 'closed' (there is no 'funded').

create table if not exists public.closing_posts (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references public.organizations(id) on delete cascade,
  lo_id                   uuid references public.profiles(id) on delete set null,
  lead_id                 uuid not null references public.leads(id) on delete cascade,
  generated_copy          text not null,
  edited_copy             text,
  compliance_check_passed boolean not null default false,
  compliance_flags        text[] not null default '{}',
  post_status             text not null default 'draft'
                          check (post_status in ('draft','approved','posted','rejected')),
  posted_platforms        text[] not null default '{}',
  generated_at            timestamptz not null default now(),
  approved_at             timestamptz,
  posted_at               timestamptz,
  created_at              timestamptz not null default now()
);
create index if not exists idx_closing_posts_org_status on public.closing_posts(org_id, post_status);
create index if not exists idx_closing_posts_lead on public.closing_posts(lead_id);

alter table public.closing_posts enable row level security;

-- INSERT-only audit trail. Compliance record of what was generated/approved/posted.
create table if not exists public.closing_post_audit (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.closing_posts(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lo_id       uuid references public.profiles(id) on delete set null,
  action      text not null check (action in
                ('generated','compliance_checked','approved','rejected','posted','edited')),
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_closing_post_audit_post on public.closing_post_audit(post_id);

alter table public.closing_post_audit enable row level security;
-- INSERT-only: never mutate or delete an audit record.
revoke update, delete, truncate on public.closing_post_audit from anon, authenticated, service_role;
