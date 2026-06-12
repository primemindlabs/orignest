-- =============================================================================
-- 017_business_pulse.sql  —  Phase 130: Business Pulse (daily org health score)
-- =============================================================================
-- Source spec: primemind-strategy/build-prompts/prompt-ashleyiq-phase-130-business-pulse.md
-- ADAPTED: users(id)->profiles(id); branch-manager RLS via profiles.role
-- (user_roles arrives in 020). One row per org per day, INSERT-only history
-- (never UPDATE/DELETE — REVOKE enforced). Computed server-side (service role).

create table if not exists public.business_pulse_scores (
  id                         uuid primary key default gen_random_uuid(),
  org_id                     uuid not null references public.organizations(id) on delete cascade,
  branch_manager_id          uuid not null references public.profiles(id),
  pulse_score                int not null check (pulse_score between 0 and 100),
  score_band                 text not null check (score_band in ('green','yellow','orange','red')),
  pipeline_velocity_score    int,
  relationship_health_score  int,
  revenue_trajectory_score   int,
  compliance_posture_score   int,
  growth_signals_score       int,
  pipeline_details           jsonb default '{}',
  relationship_details       jsonb default '{}',
  revenue_details            jsonb default '{}',
  compliance_details         jsonb default '{}',
  growth_details             jsonb default '{}',
  key_insights               jsonb default '[]',
  top_risks                  jsonb default '[]',
  top_wins                   jsonb default '[]',
  computed_at                timestamptz default now(),
  score_date                 date default current_date
);
-- One score per org per day (upsert target).
create unique index if not exists idx_business_pulse_org_date on public.business_pulse_scores (org_id, score_date);

alter table public.business_pulse_scores enable row level security;
-- Branch managers / admins read their org's pulse history (role via profiles).
create policy "branch_manager_read" on public.business_pulse_scores
  for select using (
    org_id in (select p.org_id from public.profiles p
               where p.id = auth.uid() and p.role in ('branch_manager','admin')));
-- INSERT via the service-role client only (generated server-side). History is
-- immutable — never updated or deleted:
revoke update, delete, truncate on public.business_pulse_scores from anon, authenticated, service_role;
