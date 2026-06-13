-- =============================================================================
-- Phase 113 — Condition reminders (gap-fill)
-- =============================================================================
-- The condition tracker, loan-type templates (condition_templates), document upload
-- (condition_documents), and status/clear already exist. The only missing piece is the
-- TCPA-gated borrower reminder for OUTSTANDING conditions — this table logs it.
--
-- Adapted: loans -> lead_id (borrower = lead, no borrower_id); auth.users -> org_id +
-- sent_by (profiles.id). INSERT-only audit.

create table if not exists public.condition_reminders (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id) on delete cascade,
  lead_id             uuid not null references public.leads(id) on delete cascade,
  sent_by             uuid references public.profiles(id) on delete set null,
  outstanding_count   integer not null,
  channel             text not null check (channel in ('sms','email')),
  external_message_id text,
  sent_at             timestamptz not null default now()
);
create index if not exists idx_condition_reminders_lead on public.condition_reminders (lead_id, sent_at desc);

alter table public.condition_reminders enable row level security;
revoke update, delete, truncate on public.condition_reminders from anon, authenticated, service_role;
