-- Phase 89 — Lender AE Connect. Per-LO directory of Account Executive contacts at the
-- lenders an LO works with, plus an INSERT-only submission log feeding response-time
-- stats. Adapted to the real stack: lo_id/created references profiles(id) (Clerk, not
-- auth.users), loan_id references leads(id) (loans are leads here), and rows carry
-- org_id so branch managers can see their team's connections.

create table if not exists public.lender_ae_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lo_id uuid not null references public.profiles(id) on delete cascade,

  lender_name text not null,
  lender_website text,
  lender_type text not null default 'wholesale' check (lender_type in ('wholesale','correspondent','retail','bank','credit_union')),

  ae_name text not null,
  ae_email text not null,
  ae_phone text,
  ae_cell text,
  ae_linkedin text,
  ae_title text,

  loan_types text[] not null default '{}',

  preferred boolean not null default false,
  notes text,
  last_submission_at timestamptz,
  response_time_avg_hours numeric(5,1),

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_lender_ae_conn_lo on public.lender_ae_connections(lo_id, is_active);
create index if not exists idx_lender_ae_conn_org on public.lender_ae_connections(org_id);

create table if not exists public.ae_submission_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  ae_id uuid not null references public.lender_ae_connections(id) on delete cascade,
  loan_id uuid references public.leads(id) on delete set null,
  lo_id uuid not null references public.profiles(id),
  loan_type text,
  loan_amount numeric(12,2),
  submitted_at timestamptz not null default now(),
  first_response_at timestamptz,
  response_hours numeric(7,2) generated always as (
    extract(epoch from (first_response_at - submitted_at)) / 3600
  ) stored,
  outcome text default 'pending' check (outcome in ('approved','suspended','denied','withdrawn','pending'))
);
create index if not exists idx_ae_submission_ae on public.ae_submission_log(ae_id);

alter table public.lender_ae_connections enable row level security;
alter table public.ae_submission_log enable row level security;

-- ae_submission_log is an INSERT-only audit trail (RESPA / lender-relationship paper
-- trail): revoke mutation from every role incl. service_role.
revoke update, delete, truncate on public.ae_submission_log from anon, authenticated, service_role;
