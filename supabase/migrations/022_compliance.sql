-- =============================================================================
-- 022_compliance.sql  —  CCPA / CAN-SPAM compliance (Phase 38 follow-up)
-- =============================================================================
-- data_export_requests ALREADY EXISTS (Phase 39: org_id/requested_by/export_type/
-- record_count/status/sent_at/created_at). This migration is idempotent — it
-- create-if-not-exists with the real shape (for a fresh DB) and, the load-bearing
-- part, ENFORCES the table as INSERT-only: RLS on + REVOKE update/delete/truncate
-- from every role incl. service_role. A data-subject request record is immutable.

create table if not exists public.data_export_requests (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid references public.profiles(id),
  export_type  text not null default 'ccpa_full',
  record_count integer,
  status       text not null default 'completed',
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_data_export_requests_by on public.data_export_requests(requested_by, created_at desc);

alter table public.data_export_requests enable row level security;
-- INSERT-only: never UPDATE, never DELETE, ever.
revoke update, delete, truncate on public.data_export_requests from anon, authenticated, service_role;

-- ── Account deletion (CCPA right to delete) — soft-delete request log ────────
-- INSERT-only audit of self-service deletion requests. The actual purge runs on
-- a grace-period schedule; the request itself is an immutable record.
create table if not exists public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.organizations(id) on delete set null,
  requested_by uuid references public.profiles(id),
  reason       text,
  status       text not null default 'pending' check (status in ('pending','processed','cancelled')),
  requested_at timestamptz not null default now()
);
create index if not exists idx_account_deletion_by on public.account_deletion_requests(requested_by, requested_at desc);
alter table public.account_deletion_requests enable row level security;
revoke update, delete, truncate on public.account_deletion_requests from anon, authenticated, service_role;

-- Soft-delete + analytics opt-out flags on the profile.
alter table public.profiles add column if not exists deletion_requested_at timestamptz;
alter table public.profiles add column if not exists analytics_opt_out boolean not null default false;
