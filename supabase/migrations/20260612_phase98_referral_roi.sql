-- =============================================================================
-- Phase 98 — Referral Source ROI Analytics
-- =============================================================================
-- Adapted to the real stack (Clerk, not Supabase auth):
--   * user_id -> org_id + lo_id (profiles.id, = leads.assigned_to). Per-LO analytics.
--   * gross comp source: loan_probability_scores has NO gross_comp (it's P83
--     close-probability), so gross comp = leads.loan_amount * profiles.comp_rate/100
--     (the same formula the pipeline money-bar uses).
--   * realtor auto-attribution reads leads.referral_realtor_id (P46/95), not the
--     spec's referred_by_realtor_id.
--   * RLS-on/no-policy (admin-client only, like the rest of the app); roi_snapshots
--     is INSERT-only via REVOKE.

-- ── leads: structured referral source ───────────────────────────────────────
alter table public.leads add column if not exists referral_source text
  check (referral_source in ('realtor','zillow','meta_ads','google_ads','referral','organic','other'));
alter table public.leads add column if not exists referral_source_detail text;
create index if not exists idx_leads_referral_source on public.leads (org_id, referral_source);

-- ── Source cost tracking ────────────────────────────────────────────────────
create table if not exists public.referral_source_costs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  lo_id         uuid not null references public.profiles(id) on delete cascade,
  source_type   text not null check (source_type in ('realtor','zillow','meta_ads','google_ads','referral','organic','other')),
  source_detail text,
  cost_amount   numeric(10,2) not null check (cost_amount >= 0),
  cost_period   text not null check (cost_period in ('monthly','per_lead','one_time')),
  active_from   date not null,
  active_to     date,
  created_at    timestamptz not null default now(),
  constraint referral_source_costs_active_to_after_from check (active_to is null or active_to > active_from)
);
create index if not exists idx_rsc_lo_source on public.referral_source_costs (lo_id, source_type, source_detail);
create index if not exists idx_rsc_active on public.referral_source_costs (lo_id, active_from, active_to);
alter table public.referral_source_costs enable row level security;

-- ── ROI snapshots (INSERT-only audit) ───────────────────────────────────────
create table if not exists public.roi_snapshots (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  lo_id            uuid not null references public.profiles(id) on delete cascade,
  source_type      text not null,
  source_detail    text,
  period_days      integer not null check (period_days in (30,60,90,180)),
  period_end       date not null,
  leads_count      integer default 0,
  closed_count     integer default 0,
  total_gross_comp numeric(12,2) default 0,
  total_cost       numeric(12,2) default 0,
  close_rate       numeric(5,2),
  cost_per_closed  numeric(10,2),
  roi_multiple     numeric(8,2),
  calculated_at    timestamptz not null default now()
);
create unique index if not exists idx_roi_snapshots_unique
  on public.roi_snapshots (lo_id, source_type, coalesce(source_detail, ''), period_days, period_end);
create index if not exists idx_roi_snapshots_lo_period on public.roi_snapshots (lo_id, period_days, period_end desc);
alter table public.roi_snapshots enable row level security;
-- INSERT-only: never UPDATE or DELETE a snapshot.
revoke update, delete, truncate on public.roi_snapshots from anon, authenticated, service_role;
