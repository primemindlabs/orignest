-- =============================================================================
-- Phase 144 — Ashley Concierge (Autonomous Conversational AI Engagement)
-- =============================================================================
-- The loanofficer.ai-style capability: an AI assistant that holds a two-way SMS
-- conversation with a borrower on the LO's behalf — qualifies, answers general
-- questions, books a call or starts an application, and hands off to the human the
-- moment it hits anything rate-specific, legal, or upset.
--
-- Reuses the existing rails (no new ones):
--   * inbound: app/api/webhooks/twilio-inbound (calls runConcierge)
--   * TCPA gate: lib/communications/canSendSMS  (hard gate before any auto-send)
--   * memory: lib/brain/getEntityMemories       (so the AI "knows" the borrower)
--   * send: twilio + buildSenderIdentity + nmlsDisclaimer (same as Goldmine)
--
-- Autonomy is OPT-IN per LO and per lead (default 'off'): with it off the inbound
-- webhook behaves exactly as before (creates the LO reply task). 'suggest' drafts
-- a reply for the LO to approve; 'autonomous' sends it (TCPA-gated). Org-scoped RLS
-- via public.get_org_id() (inert under Clerk — app layer also filters by org_id).
-- =============================================================================

-- ── Per-LO persona + autonomy config ─────────────────────────────────────────
create table if not exists public.ai_concierge_settings (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  lo_id              uuid references public.profiles(id) on delete cascade,

  enabled            boolean not null default false,
  -- default autonomy for NEW conversations this LO owns
  autonomy_default   text not null default 'suggest'
                      check (autonomy_default in ('off','suggest','autonomous')),
  allow_autonomous   boolean not null default false,   -- master switch for auto-send

  persona_tone       text not null default 'warm, concise, and professional',
  persona_specialties text,                            -- e.g. "FHA, VA, first-time buyers"
  products           text,                             -- free-text product notes for context
  business_goal      text not null default 'qualify the borrower and book a call or start an application',
  booking_url        text,                             -- shared by the book_appointment tool
  application_url    text,                             -- shared by the start_application tool
  max_ai_replies     integer not null default 6,       -- cap AI turns per conversation
  custom_instructions text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, lo_id)
);
create index if not exists idx_concierge_settings_org on public.ai_concierge_settings(org_id);

-- ── One conversation per lead ────────────────────────────────────────────────
create table if not exists public.ai_conversations (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  lead_id            uuid not null references public.leads(id) on delete cascade,
  lo_id              uuid references public.profiles(id) on delete set null,

  channel            text not null default 'sms' check (channel in ('sms','email')),
  autonomy_mode      text not null default 'off' check (autonomy_mode in ('off','suggest','autonomous')),
  status             text not null default 'active'
                      check (status in ('active','escalated','paused','opted_out')),
  escalation_reason  text,
  escalated_at       timestamptz,
  message_count      integer not null default 0,   -- AI replies sent/drafted (cap basis)
  last_inbound_at    timestamptz,
  last_ai_reply_at   timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, lead_id)
);
create index if not exists idx_ai_conv_org on public.ai_conversations(org_id, status);
create index if not exists idx_ai_conv_lead on public.ai_conversations(lead_id);

-- ── Turn-by-turn transcript (immutable; a draft can be approved → updates `sent`)─
create table if not exists public.ai_conversation_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  lead_id         uuid not null references public.leads(id) on delete cascade,

  role            text not null check (role in ('borrower','assistant','system','lo')),
  body            text not null,
  -- assistant rows only:
  tool_trace      jsonb,                 -- tools the agent called this turn
  gated           boolean not null default false,   -- blocked by compliance guard
  gate_reason     text,
  sent            boolean not null default false,    -- false = draft awaiting approval
  sent_at         timestamptz,

  created_at      timestamptz not null default now()
);
create index if not exists idx_ai_conv_msg_conv on public.ai_conversation_messages(conversation_id, created_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.ai_concierge_settings      enable row level security;
alter table public.ai_conversations           enable row level security;
alter table public.ai_conversation_messages   enable row level security;

drop policy if exists "concierge_settings_all" on public.ai_concierge_settings;
create policy "concierge_settings_all" on public.ai_concierge_settings for all using (org_id = public.get_org_id()) with check (org_id = public.get_org_id());

drop policy if exists "ai_conv_select" on public.ai_conversations;
create policy "ai_conv_select" on public.ai_conversations for select using (org_id = public.get_org_id());
drop policy if exists "ai_conv_insert" on public.ai_conversations;
create policy "ai_conv_insert" on public.ai_conversations for insert with check (org_id = public.get_org_id());
drop policy if exists "ai_conv_update" on public.ai_conversations;
create policy "ai_conv_update" on public.ai_conversations for update using (org_id = public.get_org_id());

drop policy if exists "ai_conv_msg_select" on public.ai_conversation_messages;
create policy "ai_conv_msg_select" on public.ai_conversation_messages for select using (org_id = public.get_org_id());
drop policy if exists "ai_conv_msg_insert" on public.ai_conversation_messages;
create policy "ai_conv_msg_insert" on public.ai_conversation_messages for insert with check (org_id = public.get_org_id());
-- a draft message may be flipped to sent on approval; otherwise immutable.
drop policy if exists "ai_conv_msg_update" on public.ai_conversation_messages;
create policy "ai_conv_msg_update" on public.ai_conversation_messages for update using (org_id = public.get_org_id());

-- Transcript is an audit trail: never deletable.
revoke delete, truncate on public.ai_conversation_messages from anon, authenticated, service_role;
