-- =============================================================================
-- Phase 143 — Generic Wholesale Submission + Lock  (LOS roadmap item #2)
-- =============================================================================
-- Outbound counterpart to the P41 LOS inbound layer and the P56/P142 PPE pricing
-- layer. Lets a broker SUBMIT a loan file to a wholesale lender and REQUEST/CONFIRM
-- a rate lock through a provider-agnostic adapter, reusing the MISMO 3.4 (ULAD)
-- export (P-roadmap #1) as the submission payload.
--
-- Three tables:
--   lender_submission_connections — per-org wholesale-lender API connections
--       (encrypted creds, submit/lock endpoints). Distinct from
--       lender_ae_connections (a per-LO AE *contact directory*, P89) and
--       los_connections (the broker's *own* LOS, P41).
--   loan_submissions — one row per outbound submission attempt, with the MISMO
--       snapshot we sent + the lender's external id/status. INSERT + UPDATE
--       (status lifecycle); never deletable (RESPA/lender paper trail).
--   loan_locks — rate-lock requests/confirmations tied to a submission/lender.
--
-- Org-scoped via public.get_org_id() (RLS is inert under Clerk — the app
-- authenticates with Clerk, not a Supabase JWT — so the app layer also filters
-- by org_id; the policies are defense-in-depth, matching every other table).
-- =============================================================================

-- ── 1. Connections ───────────────────────────────────────────────────────────
create table if not exists public.lender_submission_connections (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  created_by    uuid references public.profiles(id) on delete set null,

  lender_name   text not null,
  -- Provider-agnostic adapter key. 'generic_mismo' = the lowest-common-denominator
  -- adapter that POSTs a MISMO 3.4 file to any lender/AUS ingest endpoint. The
  -- others are structured stubs (one adapter file each) wired on demand.
  platform      text not null default 'generic_mismo'
                 check (platform in ('generic_mismo','uwm','rocket_tpo','loanstream','custom')),

  -- generic_mismo endpoints (per-lender). submit_url ingests the MISMO XML;
  -- lock_url accepts a lock request. Both optional until the lender is wired.
  submit_url    text,
  lock_url      text,
  status_url    text,

  auth_type     text not null default 'bearer'
                 check (auth_type in ('bearer','api_key','basic','none')),
  -- AES-256-GCM encrypted (lib/crypto/encrypt). Never returned to the client.
  api_key_enc   text,
  api_secret_enc text,
  base_url      text,

  is_active          boolean not null default true,
  last_submission_at timestamptz,
  last_error         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, lender_name)
);
create index if not exists idx_lsc_org on public.lender_submission_connections(org_id, is_active);

-- ── 2. Submissions ─────────────────────────────────────────────────────────────
create table if not exists public.loan_submissions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  lead_id       uuid not null references public.leads(id) on delete cascade,
  connection_id uuid references public.lender_submission_connections(id) on delete set null,
  lo_id         uuid references public.profiles(id) on delete set null,

  lender_name   text,            -- snapshot (connection may change/delete)
  platform      text,
  status        text not null default 'queued'
                 check (status in ('queued','submitted','received','in_review',
                                   'suspended','approved','denied','withdrawn','error')),
  external_loan_id text,          -- the lender's reference number
  external_status  text,          -- the lender's raw status string

  mismo_snapshot   text,          -- the exact XML we sent (audit)
  request_meta     jsonb,
  response_meta    jsonb,
  error_message    text,

  submitted_at  timestamptz,
  last_status_at timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_loan_subs_lead on public.loan_submissions(lead_id, created_at desc);
create index if not exists idx_loan_subs_org  on public.loan_submissions(org_id, status);

-- ── 3. Locks ─────────────────────────────────────────────────────────────────
create table if not exists public.loan_locks (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  lead_id       uuid not null references public.leads(id) on delete cascade,
  connection_id uuid references public.lender_submission_connections(id) on delete set null,
  submission_id uuid references public.loan_submissions(id) on delete set null,
  lo_id         uuid references public.profiles(id) on delete set null,

  lender_name   text,
  action        text not null default 'lock'
                 check (action in ('lock','extend','relock','float_down','cancel')),
  product_name  text,
  requested_rate     numeric(6,4),
  requested_price    numeric(7,4),
  lock_period_days   integer,

  locked_rate        numeric(6,4),
  locked_price       numeric(7,4),
  lock_number        text,
  lock_expiration    date,

  status        text not null default 'requested'
                 check (status in ('requested','confirmed','denied','expired','cancelled','error')),
  external_status text,
  response_meta   jsonb,
  error_message   text,

  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
create index if not exists idx_loan_locks_lead on public.loan_locks(lead_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.lender_submission_connections enable row level security;
alter table public.loan_submissions              enable row level security;
alter table public.loan_locks                    enable row level security;

-- connections: full CRUD within the org (creds managed by admins at the app layer).
drop policy if exists "lsc_select" on public.lender_submission_connections;
create policy "lsc_select" on public.lender_submission_connections for select using (org_id = public.get_org_id());
drop policy if exists "lsc_insert" on public.lender_submission_connections;
create policy "lsc_insert" on public.lender_submission_connections for insert with check (org_id = public.get_org_id());
drop policy if exists "lsc_update" on public.lender_submission_connections;
create policy "lsc_update" on public.lender_submission_connections for update using (org_id = public.get_org_id());
drop policy if exists "lsc_delete" on public.lender_submission_connections;
create policy "lsc_delete" on public.lender_submission_connections for delete using (org_id = public.get_org_id());

-- submissions: select/insert/update only (immutable paper trail — no delete).
drop policy if exists "loan_subs_select" on public.loan_submissions;
create policy "loan_subs_select" on public.loan_submissions for select using (org_id = public.get_org_id());
drop policy if exists "loan_subs_insert" on public.loan_submissions;
create policy "loan_subs_insert" on public.loan_submissions for insert with check (org_id = public.get_org_id());
drop policy if exists "loan_subs_update" on public.loan_submissions;
create policy "loan_subs_update" on public.loan_submissions for update using (org_id = public.get_org_id());

drop policy if exists "loan_locks_select" on public.loan_locks;
create policy "loan_locks_select" on public.loan_locks for select using (org_id = public.get_org_id());
drop policy if exists "loan_locks_insert" on public.loan_locks;
create policy "loan_locks_insert" on public.loan_locks for insert with check (org_id = public.get_org_id());
drop policy if exists "loan_locks_update" on public.loan_locks;
create policy "loan_locks_update" on public.loan_locks for update using (org_id = public.get_org_id());

-- Submissions + locks are an immutable audit trail: never deletable.
revoke delete, truncate on public.loan_submissions from anon, authenticated, service_role;
revoke delete, truncate on public.loan_locks       from anon, authenticated, service_role;
