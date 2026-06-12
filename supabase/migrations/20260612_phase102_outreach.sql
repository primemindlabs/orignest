-- =============================================================================
-- Phase 102 — Birthday & Anniversary Outreach
-- =============================================================================
-- Adapted to the real stack (Clerk auth + service-role admin client, NOT Supabase
-- auth/RLS) and the real schema:
--   * spec `realtor_profiles` -> `realtors` (Phase 40). FK realtor_id -> realtors(id).
--   * spec `auth.users` -> org_id + user_id (profiles.id). All reads scope by org_id
--     at the app layer (RLS inert for the admin client). user_id = attributed LO
--     (leads.assigned_to); NULL for realtor events (org-owned, not LO-owned).
--   * stage 'funded' -> 'closed'; close date is leads.closing_date.
--   * trigger fn is the existing update_updated_at() (NOT set_updated_at()).
--   * notifications use the existing `notifications` table via lib/notifications/notify.
--   * outreach_queue is INSERT-only from the UI: no INSERT policy, only the
--     service-role admin client (cron / manual trigger) inserts. LO PATCHes status
--     + tcpa_acknowledged; field allowlist enforced at the API layer.

-- ── STEP 1: borrower birthday on leads (absent on the live DB) ────────────────
alter table public.leads add column if not exists date_of_birth date;
comment on column public.leads.date_of_birth is
  'Borrower birthday. Full date stored for anniversary math; UI renders MM/DD only.';

-- ── STEP 2: life_events ───────────────────────────────────────────────────────
create table if not exists public.life_events (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  user_id            uuid references public.profiles(id) on delete set null, -- attributed LO (null for realtor events)
  lead_id            uuid references public.leads(id) on delete cascade,
  realtor_id         uuid references public.realtors(id) on delete cascade,
  event_type         text not null check (event_type in (
                       'birthday','home_anniversary','loan_anniversary','realtor_anniversary')),
  event_date         date not null,
  recurring_annually boolean not null default true,
  label              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint life_events_target_required
    check (lead_id is not null or realtor_id is not null)
);
create index if not exists life_events_org_idx        on public.life_events(org_id);
create index if not exists life_events_lead_idx       on public.life_events(lead_id);
create index if not exists life_events_realtor_idx    on public.life_events(realtor_id);
create index if not exists life_events_event_date_idx on public.life_events(event_date);
-- One event per (lead, type) and per (realtor, type). PARTIAL unique indexes —
-- NOT a NULLS-NOT-DISTINCT constraint, which would falsely collide every lead
-- event (realtor_id NULL) against every other of the same type in the org.
create unique index if not exists life_events_lead_type_uq
  on public.life_events (org_id, lead_id, event_type) where lead_id is not null;
create unique index if not exists life_events_realtor_type_uq
  on public.life_events (org_id, realtor_id, event_type) where realtor_id is not null;

-- ── STEP 3: outreach_queue ────────────────────────────────────────────────────
create table if not exists public.outreach_queue (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  user_id              uuid references public.profiles(id) on delete set null,
  life_event_id        uuid not null references public.life_events(id) on delete cascade,
  lead_id              uuid references public.leads(id) on delete set null,
  realtor_id           uuid references public.realtors(id) on delete set null,
  scheduled_send_date  date not null,
  channel              text not null check (channel in ('sms','email')),
  message_draft        text not null,
  status               text not null default 'queued'
                         check (status in ('queued','approved','sent','skipped','failed')),
  tcpa_acknowledged    boolean not null default false,
  approved_at          timestamptz,
  sent_at              timestamptz,
  failed_at            timestamptz,
  failure_reason       text,
  twilio_message_sid   text,
  resend_message_id    text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists oq_org_idx    on public.outreach_queue(org_id);
create index if not exists oq_status_idx  on public.outreach_queue(status);
create index if not exists oq_date_idx    on public.outreach_queue(scheduled_send_date);
create index if not exists oq_lead_idx    on public.outreach_queue(lead_id);
-- Dedup: at most one queue entry per life_event per calendar year per channel.
create unique index if not exists oq_dedup_idx
  on public.outreach_queue (life_event_id, (extract(year from scheduled_send_date)::int), channel);

-- ── updated_at triggers (reuse the existing update_updated_at fn) ─────────────
drop trigger if exists life_events_updated_at on public.life_events;
create trigger life_events_updated_at
  before update on public.life_events
  for each row execute function public.update_updated_at();

drop trigger if exists outreach_queue_updated_at on public.outreach_queue;
create trigger outreach_queue_updated_at
  before update on public.outreach_queue
  for each row execute function public.update_updated_at();

-- ── RLS (enabled; admin client bypasses — real enforcement is app-layer) ──────
alter table public.life_events enable row level security;
alter table public.outreach_queue enable row level security;
-- outreach_queue is system-managed: never hard-deleted (history is permanent).
revoke delete, truncate on public.outreach_queue from anon, authenticated, service_role;
-- life_events: no hard delete either — suppress via recurring_annually = false.
revoke delete, truncate on public.life_events from anon, authenticated, service_role;
