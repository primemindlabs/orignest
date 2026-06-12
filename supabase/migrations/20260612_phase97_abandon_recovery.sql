-- =============================================================================
-- Phase 97 — 1003 Application Abandon Recovery
-- =============================================================================
-- Adapted to the real stack (Clerk, not Supabase auth):
--   * org-scoped (org_id) + admin-client/RLS-on/no-policy, like the other Phase
--     94–96 tables. Audit tables are INSERT-only via REVOKE.
--   * The Smart 1003 form (Phase 59) is deferred, so nothing creates sessions
--     YET — this engine is dormant until the form calls POST /api/applications/
--     session. Send is Twilio-GATED (record-only when creds absent).
--   * Opt-out integrates with the existing leads.sms_opt_out flag honored
--     app-wide (Phase 38), in addition to the sms_opt_outs audit table.

create table if not exists public.application_sessions (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id) on delete cascade,
  lead_id                uuid not null references public.leads(id) on delete cascade,
  token                  text unique not null default encode(gen_random_bytes(20), 'hex'),
  last_section_completed text,
  completion_pct         int not null default 0 check (completion_pct between 0 and 100),
  sections_completed     text[] not null default '{}',
  sms_consent            boolean not null default false,
  borrower_phone         text,
  borrower_state         text,                       -- for the TCPA calling-window check
  started_at             timestamptz not null default now(),
  last_activity_at       timestamptz not null default now(),
  completed_at           timestamptz,
  abandoned_at           timestamptz,
  recovery_attempts_sent int not null default 0,
  created_at             timestamptz not null default now()
);
create index if not exists idx_app_sessions_lead on public.application_sessions(lead_id);
create index if not exists idx_app_sessions_token on public.application_sessions(token);
-- Cron eligibility scan.
create index if not exists idx_app_sessions_scan
  on public.application_sessions(last_activity_at, completed_at, abandoned_at, sms_consent);
alter table public.application_sessions enable row level security;

create table if not exists public.abandon_recovery_messages (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  session_id       uuid not null references public.application_sessions(id) on delete cascade,
  lead_id          uuid not null references public.leads(id) on delete cascade,
  recovery_attempt int not null check (recovery_attempt in (1, 2, 3)),
  sms_body         text not null,
  deep_link        text not null,
  delivery_status  text not null default 'sent'
                   check (delivery_status in ('sent','delivered','failed','opted_out','gated')),
  twilio_sid       text,
  opened_at        timestamptz,
  resumed_at       timestamptz,
  sent_at          timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists idx_recovery_msgs_session on public.abandon_recovery_messages(session_id);
create index if not exists idx_recovery_msgs_lead on public.abandon_recovery_messages(lead_id);
alter table public.abandon_recovery_messages enable row level security;
-- INSERT-only audit: never mutate except the cron/webhook setting opened_at/
-- resumed_at/delivery_status via the service role (which bypasses these REVOKEs).
revoke delete, truncate on public.abandon_recovery_messages from anon, authenticated, service_role;

create table if not exists public.sms_opt_outs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  phone        text not null,
  source       text not null default 'twilio_webhook',
  opted_out_at timestamptz not null default now()
);
create index if not exists idx_sms_opt_outs_lead on public.sms_opt_outs(lead_id);
alter table public.sms_opt_outs enable row level security;
revoke update, delete, truncate on public.sms_opt_outs from anon, authenticated, service_role;
