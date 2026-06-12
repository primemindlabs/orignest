-- =============================================================================
-- Phase 95 — Realtor Heat Score
-- =============================================================================
-- Adapted to the real stack (layers onto Phase 40 realtor CRM):
--   * Realtors live in `realtors` (org-scoped, NOT auth.users / per-LO). So heat
--     scores are org-scoped via org_id, keyed unique per realtor_id.
--   * The interaction log is the existing INSERT-only `realtor_touches`
--     (touch_type email/sms/call/in_person/co_marketing_send/referral_received/note).
--     `in_person` is the meeting/coffee signal for the meeting bonus.
--   * Deals are leads with `referral_realtor_id` = realtor AND stage = 'closed'.
--   * Auth is Clerk, NOT Supabase auth — there is no auth.uid(). All reads/writes
--     go through the admin (service-role) client with an explicit org_id filter,
--     so RLS is enabled with NO authenticated policy (admin-only), matching the
--     pattern used by arrive_integrations / los_connections in this codebase.
--
-- Heat score (momentum: recency + velocity) is intentionally DISTINCT from the
-- existing realtors.partnership_score (capacity: production + relationship).

create table if not exists public.realtor_heat_scores (
  id                      uuid primary key default gen_random_uuid(),
  realtor_id              uuid not null references public.realtors(id) on delete cascade,
  org_id                  uuid not null references public.organizations(id) on delete cascade,
  score                   integer not null check (score between 0 and 100),
  band                    text not null check (band in ('hot','warm','cooling','cold')),
  deals_90d               integer not null default 0,
  deals_180d              integer not null default 0,   -- internal trend input; never surfaced standalone
  days_since_last_contact integer,
  driving_factors         jsonb,
  -- driving_factors shape:
  -- { deals_90d_score, recency_score, deal_trend_score, meeting_bonus, top_signal }
  calculated_at           timestamptz not null default now(),
  unique (realtor_id)
);

create index if not exists idx_realtor_heat_org_score on public.realtor_heat_scores(org_id, score desc);
create index if not exists idx_realtor_heat_org_band  on public.realtor_heat_scores(org_id, band);

-- Admin-client only (Clerk app): enable RLS, add no authenticated policy. The
-- service-role recalc path bypasses RLS; nothing reads this table from a browser
-- session, so scores can never be spoofed client-side.
alter table public.realtor_heat_scores enable row level security;
