-- =============================================================================
-- Phase 104 — Rate Lock Extension Wizard
-- =============================================================================
-- BROWNFIELD — the spec's integration tables don't exist under those names; build
-- on the real ones (Clerk auth + admin client, org-scoped; RLS inert):
--   * spec rate_lock_alerts (Phase 84)  -> real `rate_lock_requests` (Phase 52),
--       which ALREADY has requested_lock_expiration / original_lock_expiration /
--       extension_days / extension_cost_bps / status. We add only the extension
--       outcome-tracking columns below.
--   * spec ae_connections / ae_messages (Phase 89) -> real `lender_ae_connections`
--       (ae_name/ae_email/ae_cell/preferred) + `ae_submission_log`.
--   * spec notification_log (Phase 87)   -> existing `notifications` (via notify()).
--   * businessDaysUntil/addBusinessDays   -> lib/compliance/trid (CFPB 11-holiday).
--   * trid_events for conflict check uses the real event rows (deadline_date).
--   * leads has NO lender_name, so the AE step lists the LO's active AEs to pick
--       from rather than auto-filtering by a lender the loan doesn't record.

-- ── Extension outcome tracking on the existing lock-request row ────────────────
alter table public.rate_lock_requests
  add column if not exists extension_status text
    check (extension_status in ('none','requested','approved','denied','pending'))
    default 'none',
  add column if not exists extension_requested_at timestamptz,
  add column if not exists extension_cost_est numeric(10,2);

-- ── Immutable extension audit trail (the genuinely-new piece) ──────────────────
create table if not exists public.rate_lock_extension_log (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id) on delete cascade,
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  lead_id                  uuid not null references public.leads(id) on delete cascade,
  ae_connection_id         uuid references public.lender_ae_connections(id) on delete set null,
  lock_expiry_date         date not null,
  extension_days_requested integer not null,
  bps_per_day              numeric(6,3) not null,
  loan_balance             numeric(12,2) not null,
  total_cost_est           numeric(10,2) not null,
  ae_message_text          text,
  ae_message_sent_at       timestamptz,
  outcome                  text check (outcome in ('approved','denied','pending','cancelled')),
  outcome_notes            text,
  logged_at                timestamptz not null default now(),
  created_at               timestamptz not null default now()
);
create index if not exists idx_rl_ext_log_lead    on public.rate_lock_extension_log(lead_id);
create index if not exists idx_rl_ext_log_org      on public.rate_lock_extension_log(org_id, logged_at desc);
create index if not exists idx_rl_ext_log_outcome  on public.rate_lock_extension_log(outcome);

alter table public.rate_lock_extension_log enable row level security;
-- INSERT-only audit: never UPDATE, never DELETE.
revoke update, delete, truncate on public.rate_lock_extension_log from anon, authenticated, service_role;
