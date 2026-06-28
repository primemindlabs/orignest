-- =============================================================================
-- Phase 151 — AUS: Automated Underwriting System (DU/LPA) (LOS roadmap item #6)
-- =============================================================================
-- Provider-agnostic AUS submission — Fannie Mae Desktop Underwriter (DU), Freddie Mac
-- Loan Product Advisor (LPA), or a generic MISMO 3.4 gateway. Submits the same MISMO
-- 3.4 (ULAD) URLA file the MISMO export (f2643d3) and wholesale submission (P143)
-- produce, and stores the underwriting recommendation + findings. Same gated-adapter
-- shape as the credit pull (P147), VOI/VOE (P150), and wholesale submission (P143)
-- layers: per-org encrypted vendor credentials, inert until a real AUS is connected.
--
-- aus_vendor_connections — per-org AUS provider API connection. AES-encrypted creds.
-- aus_submissions — one row per AUS run, with the underwriting recommendation,
--     eligibility, risk class, DU Casefile ID / LPA AUS Key, findings, and the exact
--     MISMO snapshot that produced them. INSERT + UPDATE; never deletable (AUS
--     findings are part of the QM/ATR + GSE rep-and-warrant documentation audit trail).
-- Org-scoped RLS via public.get_org_id() (app layer also filters; inert under Clerk).
-- =============================================================================

create table if not exists public.aus_vendor_connections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  created_by    uuid references public.profiles(id) on delete set null,
  vendor        text not null default 'generic'
                 check (vendor in ('generic','fannie_du','freddie_lpa')),
  api_url       text,
  auth_type     text not null default 'bearer'
                 check (auth_type in ('basic','bearer','api_key','none')),
  api_key_enc   text,
  api_secret_enc text,
  account_id    text,                      -- vendor account / institution id
  is_active     boolean not null default true,
  last_run_at   timestamptz,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, vendor)
);
create index if not exists idx_aus_vendor_org on public.aus_vendor_connections(org_id, is_active);

create table if not exists public.aus_submissions (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  lead_id            uuid not null references public.leads(id) on delete cascade,
  connection_id      uuid references public.aus_vendor_connections(id) on delete set null,
  lo_id              uuid references public.profiles(id) on delete set null,
  vendor             text,
  aus_system         text not null default 'du' check (aus_system in ('du','lpa')),
  status             text not null default 'queued' check (status in ('queued','pending','completed','error','gated')),
  recommendation     text,                  -- canonical: approve / accept / refer / refer_with_caution / caution / ineligible / out_of_scope / incomplete / error / unknown
  raw_recommendation text,                  -- vendor's exact wording (e.g. "Approve/Eligible")
  eligibility        text,                  -- eligible / ineligible (DU's eligibility leg)
  risk_class         text,                  -- LPA risk class / DU risk assessment
  case_file_id       text,                  -- DU Casefile ID / LPA AUS Key Number
  dti                numeric,
  ltv                numeric,
  findings           jsonb,                 -- array of { code, category, severity, text }
  report_ref         text,                  -- findings-report reference id
  mismo_snapshot     text,                  -- the exact MISMO 3.4 file submitted (audit)
  raw_response       jsonb,
  error_message      text,
  submitted_at       timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists idx_aus_submissions_lead on public.aus_submissions(lead_id, created_at desc);
create index if not exists idx_aus_submissions_org on public.aus_submissions(org_id, status);

alter table public.aus_vendor_connections enable row level security;
alter table public.aus_submissions         enable row level security;

drop policy if exists "aus_vendor_all" on public.aus_vendor_connections;
create policy "aus_vendor_all" on public.aus_vendor_connections for all using (org_id = public.get_org_id()) with check (org_id = public.get_org_id());

drop policy if exists "aus_submissions_select" on public.aus_submissions;
create policy "aus_submissions_select" on public.aus_submissions for select using (org_id = public.get_org_id());
drop policy if exists "aus_submissions_insert" on public.aus_submissions;
create policy "aus_submissions_insert" on public.aus_submissions for insert with check (org_id = public.get_org_id());
drop policy if exists "aus_submissions_update" on public.aus_submissions;
create policy "aus_submissions_update" on public.aus_submissions for update using (org_id = public.get_org_id());

-- QM/ATR + GSE rep-and-warrant documentation trail — AUS findings are never deletable.
revoke delete, truncate on public.aus_submissions from anon, authenticated, service_role;
