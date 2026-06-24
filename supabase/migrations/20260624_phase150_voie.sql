-- =============================================================================
-- Phase 150 — VOI/VOE: Verification of Income & Employment (LOS roadmap item #5)
-- =============================================================================
-- Provider-agnostic income/employment verification — Truework, The Work Number
-- (Equifax), Plaid Income, or a generic JSON endpoint. Plaid already covers ASSETS
-- (P30); this is the income/employment leg. Same gated-adapter shape as the credit
-- pull (P147), wholesale submission (P143), and PPE (P142) layers: per-org encrypted
-- vendor credentials, inert until a real vendor is connected.
--
-- voie_vendor_connections — per-org VOI/VOE vendor API connection. AES-encrypted creds.
-- voie_verifications — one row per verification request, with the verified employment
--     + income figures and the raw response. INSERT + UPDATE; never deletable
--     (income/employment is part of the QM/ATR documentation audit trail).
-- Org-scoped RLS via public.get_org_id() (app layer also filters; inert under Clerk).
-- =============================================================================

create table if not exists public.voie_vendor_connections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  created_by    uuid references public.profiles(id) on delete set null,
  vendor        text not null default 'generic'
                 check (vendor in ('generic','truework','the_work_number','plaid_income')),
  api_url       text,
  auth_type     text not null default 'bearer'
                 check (auth_type in ('basic','bearer','api_key','none')),
  api_key_enc   text,
  api_secret_enc text,
  account_id    text,                      -- vendor account / client id
  is_active     boolean not null default true,
  last_run_at   timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, vendor)
);
create index if not exists idx_voie_vendor_org on public.voie_vendor_connections(org_id, is_active);

create table if not exists public.voie_verifications (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  lead_id            uuid not null references public.leads(id) on delete cascade,
  connection_id      uuid references public.voie_vendor_connections(id) on delete set null,
  lo_id              uuid references public.profiles(id) on delete set null,
  vendor             text,
  verification_type  text not null default 'both' check (verification_type in ('income','employment','both')),
  method             text not null default 'instant' check (method in ('instant','manual')),
  applicant          text not null default 'borrower' check (applicant in ('borrower','coborrower')),
  status             text not null default 'queued' check (status in ('queued','pending','completed','error','gated')),
  verified           boolean not null default false,
  employer_name      text,
  job_title          text,
  employment_status  text,                  -- active / terminated / on_leave
  employment_start   text,                  -- vendor-reported, kept as text (varied formats)
  employment_end     text,
  annual_income      numeric,
  monthly_income     numeric,
  pay_frequency      text,
  report_ref         text,                  -- vendor's verification/report id
  raw_response       jsonb,
  error_message      text,
  verified_at        timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists idx_voie_verifications_lead on public.voie_verifications(lead_id, created_at desc);
create index if not exists idx_voie_verifications_org on public.voie_verifications(org_id, status);

alter table public.voie_vendor_connections enable row level security;
alter table public.voie_verifications       enable row level security;

drop policy if exists "voie_vendor_all" on public.voie_vendor_connections;
create policy "voie_vendor_all" on public.voie_vendor_connections for all using (org_id = public.get_org_id()) with check (org_id = public.get_org_id());

drop policy if exists "voie_verifications_select" on public.voie_verifications;
create policy "voie_verifications_select" on public.voie_verifications for select using (org_id = public.get_org_id());
drop policy if exists "voie_verifications_insert" on public.voie_verifications;
create policy "voie_verifications_insert" on public.voie_verifications for insert with check (org_id = public.get_org_id());
drop policy if exists "voie_verifications_update" on public.voie_verifications;
create policy "voie_verifications_update" on public.voie_verifications for update using (org_id = public.get_org_id());

-- QM/ATR documentation trail — verifications are never deletable.
revoke delete, truncate on public.voie_verifications from anon, authenticated, service_role;
