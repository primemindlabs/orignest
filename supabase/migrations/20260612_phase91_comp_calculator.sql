-- Phase 91 — per-LO take-home comp calculator. lo_comp_plans holds the LO's personal
-- net-comp assumptions (branch split + processor deductions) — DISTINCT from the
-- Reg-Z-authoritative `comp_plans` payout structure, which is untouched. loan_comp_estimates
-- is an INSERT-only snapshot trail. Adapted: lo_id->profiles(id), loan_id->leads(id).
--
-- Reg Z 1026.36 NOTE: comp_type is limited to bps (on loan amount) + flat_fee. A
-- "percentage of lender credit" comp type is intentionally NOT modeled — paying an LO
-- based on lender credit varies compensation by loan terms, which the LO Compensation
-- Rule prohibits. branch_split_pct / processor_fee are downstream deductions from the
-- LO's take-home, not the comp basis.

create table if not exists public.lo_comp_plans (
  lo_id uuid primary key references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  comp_type text not null default 'bps' check (comp_type in ('bps','flat_fee')),
  bps_rate numeric(6,2) default 100,        -- 100 bps = 1.00% of loan amount
  flat_fee_amount numeric(10,2),
  branch_split_pct numeric(5,2) not null default 0,
  processor_fee numeric(8,2) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_comp_estimates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  loan_id uuid not null references public.leads(id) on delete cascade,
  lo_id uuid not null references public.profiles(id),
  loan_amount numeric(12,2) not null,
  bps_rate numeric(6,2),
  gross_comp numeric(10,2) not null,
  branch_split_amount numeric(10,2) not null default 0,
  processor_fee numeric(10,2) not null default 0,
  net_comp numeric(10,2) not null,
  comp_type text not null,
  notes text,
  computed_at timestamptz not null default now()
);
create index if not exists idx_loan_comp_estimates_loan on public.loan_comp_estimates(loan_id, computed_at desc);

alter table public.lo_comp_plans enable row level security;
alter table public.loan_comp_estimates enable row level security;

-- Comp estimates are INSERT-only snapshots (the latest row per loan is current).
revoke update, delete, truncate on public.loan_comp_estimates from anon, authenticated, service_role;
