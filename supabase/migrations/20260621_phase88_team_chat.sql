-- Phase 88 — Team Chat + Compliance Archive.
-- Internal team messaging. team_chat_messages are permanent compliance records:
-- INSERT-only (no UPDATE/DELETE/TRUNCATE for ANY role incl. service_role — per the
-- non-negotiable audit rule). Namespaced team_* to avoid colliding with the Phase 31
-- loan chat (chat_messages / loan_chat_threads), a separate borrower-facing surface.

create table if not exists public.team_channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  channel_type text not null default 'public' check (channel_type in ('public','private','dm')),
  is_default boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_team_channels_org on public.team_channels(org_id);

create table if not exists public.team_channel_members (
  channel_id uuid not null references public.team_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists idx_team_channel_members_user on public.team_channel_members(user_id);

create table if not exists public.team_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.team_channels(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  body text not null,
  lead_id uuid references public.leads(id) on delete set null,    -- optional loan context
  mentions uuid[] not null default '{}',                          -- profiles.id @mentioned
  parent_id uuid references public.team_chat_messages(id),         -- thread reply
  created_at timestamptz not null default now()
  -- NO updated_at, NO deleted_at — INSERT-only compliance record by design.
);
create index if not exists idx_team_chat_messages_channel on public.team_chat_messages(channel_id, created_at);
create index if not exists idx_team_chat_messages_org on public.team_chat_messages(org_id);

create table if not exists public.team_chat_reactions (
  message_id uuid not null references public.team_chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍','✅','🔑','⚠️','❓')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- RLS (defense-in-depth; the app authenticates with Clerk and reads via the admin
-- client, so these policies are a backstop, not the primary gate).
alter table public.team_channels enable row level security;
alter table public.team_channel_members enable row level security;
alter table public.team_chat_messages enable row level security;
alter table public.team_chat_reactions enable row level security;

-- COMPLIANCE ARCHIVE: team_chat_messages can never be edited or deleted by anyone.
-- Revoke at the privilege layer so even service_role (which bypasses RLS) cannot
-- mutate history. The app exposes no update/delete path either.
revoke update, delete, truncate on public.team_chat_messages from anon, authenticated, service_role;
