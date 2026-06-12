-- =============================================================================
-- Phase 99 — Pre-Qual to Close Conversion Funnel
-- =============================================================================
-- Adapted to the real stack (Clerk, not Supabase auth):
--   * user_id -> org_id + lo_id (profiles.id = leads.assigned_to). Per-LO funnel.
--   * funnel stages are the REAL leads.stage values: 'inquiry' -> 'new_inquiry',
--     'funded' -> 'closed' (see lib/funnel/stages.ts).
--   * RLS-on/no-policy (admin-client only); both tables INSERT-only via REVOKE.
--   * stage_transitions is logged at the app layer (lib/leads/stageTransitions +
--     lead create), NOT a DB trigger.

create table if not exists public.stage_transitions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  lo_id               uuid references public.profiles(id),
  lead_id             uuid not null references public.leads(id) on delete cascade,
  from_stage          text,            -- NULL for the initial stage assignment
  to_stage            text not null,
  days_in_prior_stage integer,         -- NULL when from_stage is NULL
  transitioned_at     timestamptz not null default now(),
  created_at          timestamptz not null default now()
);
create index if not exists idx_stage_transitions_lo on public.stage_transitions (lo_id, transitioned_at desc);
create index if not exists idx_stage_transitions_lead on public.stage_transitions (lead_id, transitioned_at desc);
create index if not exists idx_stage_transitions_to on public.stage_transitions (lo_id, to_stage, transitioned_at desc);
alter table public.stage_transitions enable row level security;
-- INSERT-only audit trail: never UPDATE, never DELETE, ever.
revoke update, delete, truncate on public.stage_transitions from anon, authenticated, service_role;

create table if not exists public.conversion_funnel_snapshots (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  lo_id                     uuid not null references public.profiles(id) on delete cascade,
  period_days               integer not null check (period_days in (30,60,90,180)),
  period_end                date not null,
  stage_data                jsonb not null,
  bottleneck_stage          text,
  bottleneck_conversion_pct numeric(5,2),
  calculated_at             timestamptz not null default now()
);
create index if not exists idx_funnel_snapshots_lo on public.conversion_funnel_snapshots (lo_id, period_days, period_end desc);
create unique index if not exists idx_funnel_snapshots_unique on public.conversion_funnel_snapshots (lo_id, period_days, period_end);
alter table public.conversion_funnel_snapshots enable row level security;
revoke update, delete, truncate on public.conversion_funnel_snapshots from anon, authenticated, service_role;
