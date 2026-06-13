-- =============================================================================
-- Phase 110 — Borrower Relationship Heat Score (borrower analog of Phase 95 realtor)
-- =============================================================================
-- Banded relationship-warmth score (0–100 → hot/warm/cooling/cold) for outreach
-- prioritization, esp. surfacing post-close borrowers who are "cooling".
--
-- DISTINCT from borrower_behavior_scores (P30/P47), which is IN-PROCESS application
-- engagement (docs/logins/quiz/response → conversion). Heat is relationship warmth
-- across active + post-close (contact recency, portal login, life-event proximity,
-- referrals, post-close recency).
--
-- Adapted to the real stack (Clerk + admin client, org-scoped):
--   * auth.users -> org_id + lead_id (the borrower IS the lead) + lo_id (profiles.id =
--     leads.assigned_to). No `loans`/`borrower_id`/`portal_sessions`.
--   * portal login recency from borrower_portal_tokens.last_accessed_at (Phase 106).
--   * life-event proximity from life_events (Phase 102).
--   * INSERT-only time series (spec): a new snapshot per run; query the latest per lead.

create table if not exists public.borrower_heat_scores (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  lead_id                   uuid not null references public.leads(id) on delete cascade,
  lo_id                     uuid references public.profiles(id) on delete set null,
  score                     integer not null check (score between 0 and 100),
  band                      text not null check (band in ('hot','warm','cooling','cold')),
  days_since_last_contact   integer,
  days_since_portal_login   integer,
  days_since_close          integer,
  messages_opened_last_30d  integer not null default 0,
  life_event_within_30d     boolean not null default false,
  referrals_sent            integer not null default 0,
  driving_factors           jsonb not null default '{}',
  computed_at               timestamptz not null default now()
);
create index if not exists idx_bhs_latest on public.borrower_heat_scores (org_id, lead_id, computed_at desc);
create index if not exists idx_bhs_lo_band on public.borrower_heat_scores (org_id, lo_id, band, score);

alter table public.borrower_heat_scores enable row level security;
-- INSERT-only time series: never UPDATE, never DELETE.
revoke update, delete, truncate on public.borrower_heat_scores from anon, authenticated, service_role;
