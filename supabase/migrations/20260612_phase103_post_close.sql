-- =============================================================================
-- Phase 103 — Post-Close Equity Loop
-- =============================================================================
-- BROWNFIELD: most of the spec's "post-close monitoring" already exists. We BUILD
-- ON the existing infrastructure instead of standing up a parallel system:
--   * spec post_close_monitoring  -> existing `borrower_relationships` (Phase 28):
--       original_rate, current_market_rate, rate_delta(gen), refi_alert_threshold,
--       last_known_avm (current value), current_loan_balance, estimated_equity(gen),
--       last_close_date. We add only `monitoring_status` (opt-out, constraint #4).
--   * spec rate feed              -> existing `market_rate_snapshots` (product '30yr_fixed').
--   * spec sent-audit             -> existing `relationship_rate_alerts` (INSERT-only;
--       trigger_type in rate_drop/equity_milestone/anniversary/market_update).
--   * rate-drop detection lib     -> existing lib/relationships/refiWatch + runRateDropScan.
--   * anniversary outreach        -> owned by Phase 102 (life_events/outreach_queue); NOT
--       duplicated here. Phase 103 detects rate_drop + equity_gain only.
--
-- The genuinely-new piece is the LO REVIEW QUEUE: drafts that require human approval
-- before sending (relationship_rate_alerts only records what was already sent). That
-- is `post_close_outreach` below. Clerk auth + admin client -> org-scoped at the app
-- layer; RLS enabled but inert. Review-queue only: rate-drop NEVER auto-sends.

-- ── Opt-out / pause on the existing monitor ───────────────────────────────────
alter table public.borrower_relationships
  add column if not exists monitoring_status text not null default 'active'
  check (monitoring_status in ('active','paused','opted_out'));

-- ── Pending-review outreach queue (the new piece) ─────────────────────────────
create table if not exists public.post_close_outreach (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete set null, -- attributed sender LO
  relationship_id  uuid not null references public.borrower_relationships(id) on delete cascade,
  lead_id          uuid references public.leads(id) on delete set null,
  trigger_type     text not null check (trigger_type in ('rate_drop','equity_gain','anniversary','manual')),
  trigger_details  jsonb not null default '{}',
  outreach_message text not null,
  channel          text not null default 'sms' check (channel in ('sms','email')),
  requires_review  boolean not null default true,  -- always true in review-only mode
  status           text not null default 'queued' check (status in ('queued','sent','skipped')),
  sent_at          timestamptz,
  skipped_at       timestamptz,
  reviewed_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists pco_org_status_idx on public.post_close_outreach (org_id, status);
create index if not exists pco_relationship_idx on public.post_close_outreach (relationship_id);
create index if not exists pco_type_idx on public.post_close_outreach (trigger_type, created_at desc);

alter table public.post_close_outreach enable row level security;
-- Review queue is INSERT (by service-role detector) + status-update (LO approve/skip)
-- only; rows are an outreach record and never hard-deleted.
revoke delete, truncate on public.post_close_outreach from anon, authenticated, service_role;
