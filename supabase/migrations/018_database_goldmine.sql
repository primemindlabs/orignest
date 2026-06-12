-- =============================================================================
-- 018_database_goldmine.sql  —  Phase 131: Database Goldmine (re-engagement)
-- =============================================================================
-- Source spec: primemind-strategy/build-prompts/prompt-ashleyiq-phase-131-database-goldmine.md
-- ADAPTED: users(id)->profiles(id); loans(id)->leads(id). goldmine_market_rates
-- is public market data (Freddie Mac PMMS) — RLS left disabled per spec.

create table if not exists public.goldmine_opportunities (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  lo_id                 uuid not null references public.profiles(id),
  contact_id            uuid not null,
  contact_name          text not null,
  loan_id               uuid references public.leads(id),
  signal_type           text not null check (signal_type in (
                          'pre_approval_expired','rate_improvement','equity_milestone',
                          'loan_anniversary','long_inactive','denial_retry')),
  signal_headline       text not null,
  signal_detail         jsonb default '{}',
  priority_score        int default 50,
  estimated_loan_amount numeric,
  estimated_comp_dollars numeric,
  draft_sms             text,
  draft_email_subject   text,
  draft_email_body      text,
  status                text not null default 'surfaced' check (status in (
                          'surfaced','outreached','responded','converted','dismissed')),
  dismissed_until       date,
  surfaced_at           timestamptz default now(),
  last_updated          timestamptz default now(),
  created_at            timestamptz default now()
);
create index if not exists idx_goldmine_status on public.goldmine_opportunities (lo_id, status, priority_score desc);
create index if not exists idx_goldmine_signal on public.goldmine_opportunities (lo_id, signal_type, surfaced_at desc);

alter table public.goldmine_opportunities enable row level security;
create policy "lo_own_opportunities" on public.goldmine_opportunities
  for all using (lo_id = auth.uid());

-- ── Market rates: public reference data (Freddie Mac PMMS). No RLS. ──────────
create table if not exists public.goldmine_market_rates (
  id              uuid primary key default gen_random_uuid(),
  survey_date     date not null unique,
  rate_30yr_fixed numeric(5,3),
  rate_15yr_fixed numeric(5,3),
  rate_5yr_arm    numeric(5,3),
  source          text default 'freddie_mac_pmms',
  created_at      timestamptz default now()
);
