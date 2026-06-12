-- =============================================================================
-- Phase 100 — Automated Weekly Market Update for Realtors (email blast)
-- =============================================================================
-- DISTINCT from the existing `market_updates` table (P30/56 social-publish:
-- LinkedIn/Instagram/SMS captions) — left untouched. This is the realtor EMAIL
-- weekly update (rates + summary + talking points + per-realtor send tracking).
--
-- Adapted to the real stack (Clerk, not Supabase auth):
--   * user_id -> org_id + lo_id (profiles.id). realtor_contacts -> realtors (P40).
--   * send via the app's sendCompliantEmail path (CAN-SPAM footer enforced).

create table if not exists public.realtor_market_updates (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  lo_id             uuid not null references public.profiles(id) on delete cascade,
  week_of           date not null,
  rate_30yr_conv    numeric(5,3),
  rate_15yr_conv    numeric(5,3),
  rate_30yr_fha     numeric(5,3),
  rate_30yr_va      numeric(5,3),
  market_summary    text not null,
  talking_points    jsonb not null default '[]',
  source_disclosure text not null,
  status            text not null default 'draft' check (status in ('draft','approved','sent','cancelled')),
  approved_at       timestamptz,
  sent_at           timestamptz,
  total_recipients  int,
  generated_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);
create index if not exists idx_rmu_lo_week on public.realtor_market_updates (lo_id, week_of desc);
alter table public.realtor_market_updates enable row level security;

create table if not exists public.realtor_market_update_sends (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  update_id       uuid not null references public.realtor_market_updates(id) on delete cascade,
  realtor_id      uuid not null references public.realtors(id) on delete cascade,
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  resend_id       text,
  unsubscribed    boolean not null default false,
  unsubscribed_at timestamptz,
  skipped         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists idx_rmus_update on public.realtor_market_update_sends (update_id);
create index if not exists idx_rmus_realtor on public.realtor_market_update_sends (realtor_id);
alter table public.realtor_market_update_sends enable row level security;

create table if not exists public.realtor_market_update_settings (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  lo_id                uuid not null references public.profiles(id) on delete cascade unique,
  auto_send_enabled    boolean not null default false,
  send_day             text not null default 'monday' check (send_day in ('monday','tuesday','wednesday','thursday','friday')),
  send_hour_utc        int not null default 13,
  rate_source_note     text,
  email_subject_prefix text default 'This Week in Mortgage Rates',
  created_at           timestamptz not null default now()
);
alter table public.realtor_market_update_settings enable row level security;

-- Per-realtor opt-out of the weekly market update (used to exclude from sends).
alter table public.realtors add column if not exists unsubscribed_market_update boolean not null default false;
