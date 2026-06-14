-- =============================================================================
-- Phase 128 — Ashley Autopilot™ (Daily Action Queue → Mortgage Copilot™)
-- =============================================================================
-- The morning action queue: each night/morning Ashley reviews the LO's whole book
-- and surfaces the 5–8 highest-leverage actions, each with a plain-English reason
-- and a pre-drafted message. LO reviews → approves (individually or all) → a 5-min
-- undo window → executor sends. Every state transition is logged immutably; that
-- audit trail is the foundation for the Phase-3 Mortgage Copilot™ autonomous mode.
--
-- Adapted to the real stack (Clerk + admin client, org-scoped; spec assumed Supabase
-- auth + `loans`/`users` tables that don't exist here):
--   * lo_id   -> profiles(id)        (the LO; = leads.assigned_to)
--   * org_id  -> organizations(id)
--   * loan_id -> leads(id)           (the loan IS the lead — Phase 43)
--   * entity_id is a bare uuid: a leads(id) for borrowers, realtors(id) for realtors.
--     (No FK — it's polymorphic across entity_type.)
--   * RLS enabled with no client policy: every accessor is the service-role admin
--     client behind getOrgContext() app-layer scoping (mirrors Phase 110 / 95 crons).
-- =============================================================================

-- ── autopilot_actions: the recommended action queue (mutable status lifecycle) ──
create table if not exists public.autopilot_actions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  lo_id               uuid not null references public.profiles(id) on delete cascade,

  -- What Ashley is recommending
  action_type         text not null check (action_type in (
                        'send_sms', 'send_email', 'internal_alert',
                        'trigger_workflow', 'schedule_call_reminder')),
  signal_type         text not null,            -- e.g. 'condition_aging', 'heat_score_drop', 'birthday'
  signal_reason       text not null,            -- plain English "why"
  recommended_content text,                     -- pre-drafted message (null for internal_alert)
  recommended_subject text,                     -- email subject if action_type = send_email

  -- Entity context (polymorphic)
  entity_type         text not null check (entity_type in (
                        'borrower', 'realtor', 'lender_ae', 'referral_partner')),
  entity_id           uuid not null,            -- leads(id) for borrower, realtors(id) for realtor
  entity_name         text not null,            -- denormalized for display
  loan_id             uuid references public.leads(id) on delete cascade,

  -- Status lifecycle
  status              text not null default 'pending' check (status in (
                        'pending', 'approved', 'executing', 'executed',
                        'rejected', 'undone', 'expired')),

  -- Execution tracking
  approved_at         timestamptz,
  approved_by         uuid references public.profiles(id) on delete set null,
  executed_at         timestamptz,
  undo_deadline       timestamptz,              -- approved_at + 5 minutes
  undo_used_at        timestamptz,
  rejected_at         timestamptz,
  rejection_reason    text,
  failure_reason      text,                     -- e.g. 'TCPA_BLOCKED' on a blocked send

  -- Generation metadata
  generated_at        timestamptz not null default now(),
  generated_date      date not null default current_date,
  priority            int not null default 5,   -- 1 (urgent) … 10 (low)

  created_at          timestamptz not null default now()
);

create index if not exists idx_autopilot_today
  on public.autopilot_actions (lo_id, generated_date, status);
create index if not exists idx_autopilot_lo_status_priority
  on public.autopilot_actions (lo_id, status, priority);
create index if not exists idx_autopilot_org
  on public.autopilot_actions (org_id, generated_date);
-- Executor sweep: approved actions whose undo window has passed.
create index if not exists idx_autopilot_exec_due
  on public.autopilot_actions (status, undo_deadline);
-- Idempotency guard: one queue per (lo, day).
create unique index if not exists idx_autopilot_dedupe_entity
  on public.autopilot_actions (lo_id, generated_date, entity_id, signal_type);

alter table public.autopilot_actions enable row level security;
-- No client policy: only the service-role admin client touches this (RLS-bypassed),
-- and app-layer getOrgContext() + lo_id scoping enforces isolation. Mirrors P110.

-- ── autopilot_audit_log: INSERT-only, permanent. Never UPDATE. Never DELETE. ──
create table if not exists public.autopilot_audit_log (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null,
  lo_id                    uuid not null,
  autopilot_action_id      uuid not null references public.autopilot_actions(id) on delete cascade,
  event                    text not null check (event in (
                             'generated', 'approved', 'rejected', 'executed',
                             'undo_requested', 'undo_completed', 'expired', 'failed')),
  event_metadata           jsonb not null default '{}',
  tcpa_consent_verified    boolean,
  nmls_disclaimer_injected boolean,
  created_at               timestamptz not null default now()
);

create index if not exists idx_autopilot_audit_action
  on public.autopilot_audit_log (autopilot_action_id, created_at);
create index if not exists idx_autopilot_audit_lo
  on public.autopilot_audit_log (lo_id, created_at desc);

alter table public.autopilot_audit_log enable row level security;
-- INSERT-only time series: never UPDATE, never DELETE, never TRUNCATE.
revoke update, delete, truncate on public.autopilot_audit_log from anon, authenticated, service_role;
