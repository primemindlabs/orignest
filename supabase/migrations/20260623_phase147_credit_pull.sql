-- =============================================================================
-- Phase 147 — Generic multi-vendor credit pull (LOS roadmap item #3)
-- =============================================================================
-- Provider-agnostic ORIGINATION credit pull — the tri-merge hard/soft pull that
-- feeds underwriting. Distinct from the existing credit-REPAIR / monitoring surface
-- (soft pulls, dispute letters, CROA). Same gated-adapter shape as the LOS (P41),
-- PPE (P56/P142), and wholesale-submission (P143) layers: per-org encrypted vendor
-- credentials, and a pull that's inert until a real vendor is connected.
--
-- credit_vendor_connections — per-org credit-vendor API connection (Factual Data,
--     CBC/MeridianLink, Xactus, Credco, or a generic endpoint). AES-encrypted creds.
-- credit_report_pulls — one row per pull, with the tri-bureau scores + the raw response.
--     INSERT + UPDATE; never deletable (FCRA / permissible-purpose audit trail).
-- Org-scoped RLS via public.get_org_id() (app layer also filters; inert under Clerk).
-- =============================================================================

create table if not exists public.credit_vendor_connections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  created_by    uuid references public.profiles(id) on delete set null,
  vendor        text not null default 'generic'
                 check (vendor in ('generic','factual_data','cbc','meridianlink','xactus','credco')),
  api_url       text,
  auth_type     text not null default 'basic'
                 check (auth_type in ('basic','bearer','api_key','none')),
  api_key_enc   text,
  api_secret_enc text,
  account_id    text,                      -- vendor account / subscriber number
  is_active     boolean not null default true,
  last_pull_at  timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, vendor)
);
create index if not exists idx_credit_vendor_org on public.credit_vendor_connections(org_id, is_active);

create table if not exists public.credit_report_pulls (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  lead_id         uuid not null references public.leads(id) on delete cascade,
  connection_id   uuid references public.credit_vendor_connections(id) on delete set null,
  lo_id           uuid references public.profiles(id) on delete set null,
  vendor          text,
  pull_type       text not null default 'soft' check (pull_type in ('soft','hard')),
  applicant       text not null default 'borrower' check (applicant in ('borrower','coborrower','joint')),
  status          text not null default 'queued' check (status in ('queued','completed','error','gated')),
  equifax_score   integer,
  experian_score  integer,
  transunion_score integer,
  mid_score       integer,                 -- middle of 3 (or lower of 2)
  report_ref      text,                    -- vendor's report id
  tradeline_count integer,
  raw_response    jsonb,
  error_message   text,
  pulled_at       timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_credit_report_pulls_lead on public.credit_report_pulls(lead_id, created_at desc);
create index if not exists idx_credit_report_pulls_org on public.credit_report_pulls(org_id, status);

alter table public.credit_vendor_connections enable row level security;
alter table public.credit_report_pulls              enable row level security;

drop policy if exists "cvc_all" on public.credit_vendor_connections;
create policy "cvc_all" on public.credit_vendor_connections for all using (org_id = public.get_org_id()) with check (org_id = public.get_org_id());

drop policy if exists "credit_report_pulls_select" on public.credit_report_pulls;
create policy "credit_report_pulls_select" on public.credit_report_pulls for select using (org_id = public.get_org_id());
drop policy if exists "credit_report_pulls_insert" on public.credit_report_pulls;
create policy "credit_report_pulls_insert" on public.credit_report_pulls for insert with check (org_id = public.get_org_id());
drop policy if exists "credit_report_pulls_update" on public.credit_report_pulls;
create policy "credit_report_pulls_update" on public.credit_report_pulls for update using (org_id = public.get_org_id());

-- FCRA audit trail — credit pulls are never deletable.
revoke delete, truncate on public.credit_report_pulls from anon, authenticated, service_role;
