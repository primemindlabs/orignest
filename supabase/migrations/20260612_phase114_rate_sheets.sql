-- =============================================================================
-- Phase 114 — AI Rate Sheet Parser
-- =============================================================================
-- Ingest a lender rate sheet, extract pricing/LLPAs via Claude Haiku, query the best
-- adjusted price for a borrower profile. Distinct from the manual `lenders`/
-- `lender_products` matrix (P44) and the co-marketing rate flyer.
--
-- Adapted to the real stack:
--   * auth.users -> org_id + lo_id (profiles.id). Scoped at the app layer.
--   * NO server-side PDF text extraction lib is installed (and we don't add one), so
--     extraction runs on PASTED rate-sheet text; pdf_storage_path is OPTIONAL (the PDF,
--     if uploaded, is stored as the source-of-record only). PDF auto-parse is gated on
--     adding a pdf-text dependency.

create table if not exists public.rate_sheets (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  lo_id               uuid not null references public.profiles(id) on delete cascade,
  lender_name         text not null,
  effective_date      date not null,
  expiration_date     date,
  pdf_storage_path    text,
  raw_extracted_json  jsonb,
  is_active           boolean not null default true,
  loan_types          text[] not null default '{}',
  parsed_at           timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_rate_sheets_lo on public.rate_sheets (org_id, lo_id, is_active);

create table if not exists public.rate_sheet_products (
  id                uuid primary key default gen_random_uuid(),
  rate_sheet_id     uuid not null references public.rate_sheets(id) on delete cascade,
  loan_type         text not null,
  term_years        integer not null,
  amortization_type text not null,
  base_rate         numeric(5,3) not null,
  base_price        numeric(6,3),
  lock_period_days  integer default 30,
  min_fico          integer,
  max_fico          integer,
  min_ltv           numeric(5,2),
  max_ltv           numeric(5,2),
  max_loan_amount   numeric(12,2),
  min_loan_amount   numeric(12,2),
  created_at        timestamptz not null default now()
);
create index if not exists idx_rsp_sheet on public.rate_sheet_products (rate_sheet_id, loan_type, term_years);

create table if not exists public.rate_sheet_llpas (
  id              uuid primary key default gen_random_uuid(),
  rate_sheet_id   uuid not null references public.rate_sheets(id) on delete cascade,
  adjuster_name   text not null,
  fico_min        integer,
  fico_max        integer,
  ltv_min         numeric(5,2),
  ltv_max         numeric(5,2),
  loan_purpose    text,
  adjustment      numeric(6,3) not null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_rsl_sheet on public.rate_sheet_llpas (rate_sheet_id);

alter table public.rate_sheets enable row level security;
alter table public.rate_sheet_products enable row level security;
alter table public.rate_sheet_llpas enable row level security;
