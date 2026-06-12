-- =============================================================================
-- Phase 107 — Milestone Automation Rules
-- =============================================================================
-- Per-LO rules: "when a loan reaches <stage>, send <sms/email> to <borrower/realtor>".
-- Fires from the Phase 99 stage-transition handler (lib/funnel/logTransition). All SMS
-- requires LO approval (TCPA); email may auto-send. Every trigger is logged.
--
-- Adapted to the real stack (Clerk + admin client, org-scoped):
--   * auth.users -> org_id + user_id (profiles.id). Scoped by org_id + user_id.
--   * realtor recipient resolved via leads.referral_realtor_id -> realtors (the spec's
--     referring_realtor_* columns don't exist).
--   * portal link uses borrower_portal_tokens (Phase 106) + the /b/<token> redirect.
--   * trigger_stage uses REAL leads.stage values (new_inquiry…closed).
--   * The generic `automations` table (P30) is a different engine — not reused here.
--
-- The LOG is append + approval-lifecycle-update only (no client mutation; no deletes).
-- We REVOKE delete/truncate but KEEP update, because the approve/skip flow updates
-- approval_status via the service-role admin client (this app has no per-user JWT).

create table if not exists public.milestone_automation_rules (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  rule_name          text not null,
  trigger_stage      text not null,
  action_type        text not null check (action_type in (
    'sms_borrower','sms_realtor','email_borrower','email_realtor','internal_note')),
  message_template   text not null,
  active             boolean not null default true,
  requires_approval  boolean not null default true,   -- ALWAYS true for SMS
  auto_send_email    boolean not null default false,
  delay_minutes      integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_mar_user_active on public.milestone_automation_rules(org_id, user_id, active);
create index if not exists idx_mar_stage on public.milestone_automation_rules(trigger_stage);

create table if not exists public.milestone_automation_log (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  rule_id            uuid not null references public.milestone_automation_rules(id) on delete cascade,
  lead_id            uuid not null references public.leads(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  triggered_at       timestamptz not null default now(),
  action_type        text not null,
  rendered_message   text not null,
  recipient_type     text not null,
  recipient_phone    text,
  recipient_email    text,
  approval_status    text not null default 'pending'
    check (approval_status in ('pending','approved','auto_sent','skipped','failed')),
  approved_at        timestamptz,
  approved_by        uuid references public.profiles(id) on delete set null,
  sent_at            timestamptz,
  twilio_message_sid text,
  resend_message_id  text,
  failed_reason      text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_mal_queue on public.milestone_automation_log(org_id, user_id, approval_status, triggered_at desc);
create index if not exists idx_mal_lead on public.milestone_automation_log(lead_id);
create index if not exists idx_mal_rule on public.milestone_automation_log(rule_id);

alter table public.milestone_automation_rules enable row level security;
alter table public.milestone_automation_log enable row level security;
-- Audit log: never deleted. UPDATE kept for the approval lifecycle (admin client).
revoke delete, truncate on public.milestone_automation_log from anon, authenticated, service_role;
