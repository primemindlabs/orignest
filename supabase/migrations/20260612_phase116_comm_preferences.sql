-- =============================================================================
-- Phase 116 — TCPA & Communication Preference Center (gap-fill)
-- =============================================================================
-- The TCPA window check (lib/communications/tcpaWindow), opt-out (sms_opt_outs +
-- leads.sms_opt_out), STOP webhook (twilio-inbound), consent evidence (leads.
-- sms_consent + sms_consent_ip/text/obtained_at), and a comms audit (communication_
-- events) already exist. This adds the genuine gaps:
--   * granular per-contact preferences (per-category SMS + time window)
--   * an immutable, consent-specific audit log
-- Keyed on lead_id (the borrower IS the lead — no auth.users/profiles.tcpa_acknowledged).

create table if not exists public.communication_preferences (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  lead_id              uuid not null references public.leads(id) on delete cascade,
  lo_id                uuid references public.profiles(id) on delete set null,

  sms_opted_in         boolean not null default false,
  email_opted_in       boolean not null default true,
  voicemail_opted_in   boolean not null default false,

  sms_loan_updates     boolean not null default true,
  sms_reminders        boolean not null default true,
  sms_marketing        boolean not null default false,

  contact_time_start   time not null default '09:00',
  contact_time_end     time not null default '20:00',
  contact_timezone     text not null default 'America/New_York',

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (org_id, lead_id)
);

-- INSERT-only legal/regulatory consent record — never UPDATE, never DELETE.
create table if not exists public.consent_audit_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  lead_id       uuid not null references public.leads(id) on delete cascade,
  lo_id         uuid references public.profiles(id) on delete set null,
  event_type    text not null check (event_type in (
    'initial_tcpa_consent','sms_opt_in','sms_opt_out','email_opt_in','email_opt_out',
    'preference_update','consent_form_signed','lo_manual_update')),
  ip_address    text,
  user_agent    text,
  consent_text  text,
  channel       text,
  source        text,
  old_value     text,
  new_value     text,
  occurred_at   timestamptz not null default now()
);
create index if not exists idx_consent_audit_lead on public.consent_audit_log (org_id, lead_id, occurred_at desc);

alter table public.communication_preferences enable row level security;
alter table public.consent_audit_log enable row level security;
revoke update, delete, truncate on public.consent_audit_log from anon, authenticated, service_role;
