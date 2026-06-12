-- =============================================================================
-- Phase 101 — LOA: Internal Business Intelligence AI (query audit log)
-- =============================================================================
-- Adapted to the real stack (Clerk auth, not Supabase auth):
--   * spec's `user_id uuid references auth.users` -> org_id + user_id (profiles.id).
--     The app authenticates with Clerk; every query is scoped at the app layer by
--     org_id + the caller's profile id (resolved from clerk_user_id). RLS is enabled
--     but inert for the service-role admin client the routes use.
--   * INSERT-only audit trail (compliance): never UPDATE, never DELETE, ever.
--   * No PII columns. `question`/`answer` must never contain borrower last names,
--     SSNs, DOBs, income, or account numbers — enforced by lib/loa/context.ts (which
--     never SELECTs those columns) + the system prompt, not by a DB constraint.

create table if not exists public.loa_queries (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  question            text not null,
  answer              text not null,
  sources             text[] not null default '{}',
  context_fields_used text[] not null default '{}',
  model_version       text not null default 'claude-haiku-4-5-20251001',
  tokens_used         integer,
  created_at          timestamptz not null default now()
);

-- Rate-limit check (count a user's queries in the trailing 24h) + history feed.
create index if not exists idx_loa_queries_user_created
  on public.loa_queries (user_id, created_at desc);
create index if not exists idx_loa_queries_org_created
  on public.loa_queries (org_id, created_at desc);

alter table public.loa_queries enable row level security;

-- INSERT-only audit log: absence of UPDATE/DELETE is the enforcement mechanism.
revoke update, delete, truncate on public.loa_queries from anon, authenticated, service_role;
