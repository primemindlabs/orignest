-- =============================================================================
-- Phase 115 — Loan Product Scenario Builder
-- =============================================================================
-- Per-loan, persisted side-by-side scenarios (distinct from the standalone /scenarios
-- payment calculator, the P69 pricing_scenarios, and the P44 scenario_runs AI matches).
-- Adapted: loans -> lead_id; auth.users -> org_id + lo_id (profiles.id); no borrower_id.
-- rate_sheet_id -> rate_sheets (Phase 114). Mutable working data (LO iterates) — not
-- INSERT-only; "soft archive" via is_visible_to_borrower.

create table if not exists public.loan_scenarios (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  lo_id                    uuid not null references public.profiles(id) on delete cascade,
  lead_id                  uuid references public.leads(id) on delete cascade,
  scenario_name            text not null default 'Scenario',
  sort_order               integer not null default 0,

  loan_type                text not null check (loan_type in ('conventional','fha','va','dscr','jumbo','arm_5_1','arm_7_1')),
  purchase_price           numeric(12,2) not null,
  down_payment_pct         numeric(5,2) not null,
  loan_amount              numeric(12,2) not null,
  interest_rate            numeric(5,3) not null,
  loan_term_months         integer not null default 360,

  monthly_payment          numeric(10,2),
  total_interest_paid      numeric(12,2),
  total_cost_of_loan       numeric(12,2),

  lender_name              text,
  rate_sheet_id            uuid references public.rate_sheets(id) on delete set null,

  is_visible_to_borrower   boolean not null default false,
  is_recommended           boolean not null default false,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists idx_loan_scenarios_lead on public.loan_scenarios (org_id, lead_id, sort_order);

create table if not exists public.scenario_sets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  lo_id             uuid not null references public.profiles(id) on delete cascade,
  lead_id           uuid references public.leads(id) on delete cascade,
  title             text not null default 'Loan Comparison',
  scenario_ids      uuid[] not null,
  pdf_storage_path  text,
  shared_at         timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists idx_scenario_sets_lead on public.scenario_sets (org_id, lead_id, created_at desc);

alter table public.loan_scenarios enable row level security;
alter table public.scenario_sets enable row level security;
