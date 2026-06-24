-- =============================================================================
-- Phase 148 — Disclosure (Loan Estimate) generation (LOS roadmap item #4)
-- =============================================================================
-- The existing /disclosures surface TRACKS the TRID clock (le_issued/cd_issued
-- events, deadlines, changed-circumstances, CD balancer). This adds the missing
-- piece: GENERATING the borrower-facing Loan Estimate from the application + a fee
-- worksheet, issuing it (which logs an le_issued trid_event so the existing clock
-- picks it up), and delivering it to the borrower for acknowledgment via a token link.
--
-- disclosure_packages — one row per generated/issued disclosure package, with the
--   computed figures snapshot (le_data) + a borrower delivery token + the
--   delivered/acknowledged lifecycle. INSERT + UPDATE.
-- Org-scoped RLS; borrower delivery uses the service-role admin client + the token.
-- =============================================================================

create table if not exists public.disclosure_packages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  lead_id         uuid not null references public.leads(id) on delete cascade,
  lo_id           uuid references public.profiles(id) on delete set null,
  package_type    text not null default 'le' check (package_type in ('le','initial','redisclosure')),
  status          text not null default 'draft' check (status in ('draft','issued','delivered','acknowledged')),
  le_data         jsonb not null default '{}'::jsonb,   -- computed Loan Estimate snapshot
  delivery_token  text unique,                          -- borrower view/ack link
  issued_at       timestamptz,
  delivered_at    timestamptz,
  acknowledged_at timestamptz,
  acknowledged_ip text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_disc_pkg_lead on public.disclosure_packages(lead_id, created_at desc);
create index if not exists idx_disc_pkg_org on public.disclosure_packages(org_id);

alter table public.disclosure_packages enable row level security;
drop policy if exists "disc_pkg_select" on public.disclosure_packages;
create policy "disc_pkg_select" on public.disclosure_packages for select using (org_id = public.get_org_id());
drop policy if exists "disc_pkg_insert" on public.disclosure_packages;
create policy "disc_pkg_insert" on public.disclosure_packages for insert with check (org_id = public.get_org_id());
drop policy if exists "disc_pkg_update" on public.disclosure_packages;
create policy "disc_pkg_update" on public.disclosure_packages for update using (org_id = public.get_org_id());

-- Disclosure record is an audit artifact: never deletable.
revoke delete, truncate on public.disclosure_packages from anon, authenticated, service_role;
