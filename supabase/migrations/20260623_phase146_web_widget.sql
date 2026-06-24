-- =============================================================================
-- Phase 146 — Website AI Chat Widget
-- =============================================================================
-- The loanofficer.ai "turn website visitors into pre-qual leads" surface: an
-- embeddable chat bubble an LO drops on their own site. An anonymous visitor chats
-- with Ashley (general mortgage Q&A), she naturally collects name/email/phone +
-- SMS consent, and on capture we create a `leads` row owned by that LO — which then
-- flows into the existing Concierge + speed-to-lead pipeline (P144/P145).
--
-- Public surface: the widget identifies by an unguessable `public_key` (in the embed
-- snippet) and each visitor by a `session_token`. The public APIs use the admin
-- client (service role) and verify those in-handler, so RLS here only walls the
-- dashboard reads. The same compliance guard + persona as the Concierge apply.
-- =============================================================================

create table if not exists public.ai_web_widgets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lo_id       uuid references public.profiles(id) on delete set null,
  public_key  text not null unique,          -- goes in the embed snippet
  enabled     boolean not null default true,
  headline    text not null default 'Questions about your mortgage?',
  greeting    text not null default 'Hi! I can answer mortgage questions and help you get started. What brings you in today?',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, lo_id)
);
create index if not exists idx_web_widgets_org on public.ai_web_widgets(org_id);

create table if not exists public.ai_web_sessions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations(id) on delete cascade,
  widget_id       uuid not null references public.ai_web_widgets(id) on delete cascade,
  session_token   text not null unique,
  visitor_name    text,
  visitor_email   text,
  visitor_phone   text,
  sms_consent     boolean not null default false,
  captured        boolean not null default false,   -- contact info collected
  lead_id         uuid references public.leads(id) on delete set null,
  status          text not null default 'active' check (status in ('active','captured','closed')),
  message_count   integer not null default 0,
  created_at      timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists idx_web_sessions_widget on public.ai_web_sessions(widget_id, created_at desc);
create index if not exists idx_web_sessions_org on public.ai_web_sessions(org_id);

create table if not exists public.ai_web_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.ai_web_sessions(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  role        text not null check (role in ('visitor','assistant')),
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_web_messages_session on public.ai_web_messages(session_id, created_at);

-- ── RLS (dashboard reads; public writes go through the service-role admin client) ──
alter table public.ai_web_widgets   enable row level security;
alter table public.ai_web_sessions  enable row level security;
alter table public.ai_web_messages  enable row level security;

drop policy if exists "web_widgets_all" on public.ai_web_widgets;
create policy "web_widgets_all" on public.ai_web_widgets for all using (org_id = public.get_org_id()) with check (org_id = public.get_org_id());

drop policy if exists "web_sessions_select" on public.ai_web_sessions;
create policy "web_sessions_select" on public.ai_web_sessions for select using (org_id = public.get_org_id());
drop policy if exists "web_messages_select" on public.ai_web_messages;
create policy "web_messages_select" on public.ai_web_messages for select using (org_id = public.get_org_id());

revoke delete, truncate on public.ai_web_messages from anon, authenticated, service_role;
