-- =============================================================================
-- Phase 112 — DSCR Investment Analyzer (5–9 unit small multifamily) audit table
-- =============================================================================
-- Adapted to the real stack (Clerk + org-scoped):
--   * loans -> leads (lead_id, nullable — the analyzer is a standalone tool too).
--   * auth.users -> org_id + lo_id (profiles.id). No borrower_id (borrower = lead).
--   * INSERT-only audit/compliance (REVOKE update/delete/truncate).
-- The DSCR/NOI math reuses the established model (lib/loans/calculators) + adds the
-- small-commercial capex line and unit-count thresholds (lib/dscr/analyzer).

create table if not exists public.dscr_analyses (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  lo_id                     uuid references public.profiles(id) on delete set null,
  lead_id                   uuid references public.leads(id) on delete set null,

  property_address          text not null,
  unit_count                integer not null check (unit_count between 1 and 9),
  property_type             text not null check (property_type in ('residential_dscr','small_commercial')),

  gross_monthly_rent        numeric(10,2) not null,
  vacancy_rate_pct          numeric(4,2) not null default 5.00,

  monthly_taxes             numeric(10,2),
  monthly_insurance         numeric(10,2),
  monthly_hoa               numeric(10,2) not null default 0,
  management_pct            numeric(4,2) not null default 8.00,
  maintenance_pct           numeric(4,2) not null default 5.00,
  capex_reserve_pct         numeric(4,2) not null default 3.00,

  purchase_price            numeric(12,2),
  loan_amount               numeric(12,2) not null,
  interest_rate             numeric(5,3) not null,
  loan_term_months          integer not null default 360,

  effective_gross_income    numeric(10,2) generated always as (gross_monthly_rent * (1 - vacancy_rate_pct / 100)) stored,
  total_operating_expenses  numeric(10,2),
  net_operating_income      numeric(10,2),
  monthly_debt_service      numeric(10,2),
  dscr                      numeric(5,3),
  qualifies                 boolean,
  notes                     text,

  created_at                timestamptz not null default now()
);
create index if not exists idx_dscr_analyses_org on public.dscr_analyses (org_id, created_at desc);
create index if not exists idx_dscr_analyses_lead on public.dscr_analyses (lead_id);

alter table public.dscr_analyses enable row level security;
-- INSERT-only audit record.
revoke update, delete, truncate on public.dscr_analyses from anon, authenticated, service_role;
