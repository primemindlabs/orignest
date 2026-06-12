-- =============================================================================
-- 016_file_intelligence.sql  —  Phase 129: File Intelligence Suite
-- =============================================================================
-- Source spec: primemind-strategy/build-prompts/prompt-ashleyiq-phase-129-file-intelligence-suite.md
-- ADAPTED: users(id)->profiles(id); loans(id)->leads(id); branch-manager RLS via
-- profiles.role (user_roles arrives in 020). The history table is INSERT+SELECT
-- only (REVOKE enforced); the spec's history RLS referenced an lo_id the table
-- lacked, so lo_id is added here for the policy to function.

create table if not exists public.loan_intelligence_scores (
  id                       uuid primary key default gen_random_uuid(),
  loan_id                  uuid not null references public.leads(id) on delete cascade,
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  lo_id                    uuid not null references public.profiles(id),
  file_health_score        int check (file_health_score between 0 and 100),
  close_probability        float check (close_probability between 0.0 and 1.0),
  uw_readiness_score       int check (uw_readiness_score between 0 and 100),
  predicted_close_date     date,
  predicted_close_confidence text check (predicted_close_confidence in ('high','medium','low')),
  fallout_flags            jsonb default '[]',
  health_drivers           jsonb default '{}',
  uw_drivers               jsonb default '{}',
  computed_at              timestamptz default now(),
  computation_version      text default '1.0',
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
-- One active score set per loan (upsert on loan_id).
create unique index if not exists idx_loan_intel_scores_loan on public.loan_intelligence_scores (loan_id);

alter table public.loan_intelligence_scores enable row level security;
create policy "lo_own_scores" on public.loan_intelligence_scores
  for all using (lo_id = auth.uid());
create policy "branch_manager_read" on public.loan_intelligence_scores
  for select using (
    org_id in (select p.org_id from public.profiles p
               where p.id = auth.uid() and p.role in ('branch_manager','admin')));

-- ── History: append-only score trail. INSERT + SELECT, never UPDATE/DELETE. ──
create table if not exists public.loan_intelligence_history (
  id                 uuid primary key default gen_random_uuid(),
  loan_id            uuid not null references public.leads(id),
  org_id             uuid not null references public.organizations(id),
  lo_id              uuid references public.profiles(id),   -- added for RLS (not in spec table)
  file_health_score  int,
  close_probability  float,
  uw_readiness_score int,
  predicted_close_date date,
  fallout_flag_count int,
  trigger_event      text not null check (trigger_event in (
                       'condition_update','stage_change','document_upload','nightly_refresh','manual_refresh')),
  computed_at        timestamptz default now()
);
create index if not exists idx_loan_intel_hist_loan on public.loan_intelligence_history (loan_id, computed_at desc);
alter table public.loan_intelligence_history enable row level security;
create policy "lo_insert_history" on public.loan_intelligence_history
  for insert with check (lo_id = auth.uid());
create policy "lo_read_history" on public.loan_intelligence_history
  for select using (lo_id = auth.uid());
revoke update, delete, truncate on public.loan_intelligence_history from anon, authenticated, service_role;
