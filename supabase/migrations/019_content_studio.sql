-- =============================================================================
-- 019_content_studio.sql  —  Phase 132: Content Studio (weekly social packages)
-- =============================================================================
-- Source spec: primemind-strategy/build-prompts/prompt-ashleyiq-phase-132-content-studio.md
-- ADAPTED: users(id)->profiles(id). LO-scoped; auth.uid() policies harden direct
-- access while the app operates via the service-role admin client.

create table if not exists public.content_packages (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  lo_id              uuid not null references public.profiles(id),
  week_of            date not null,
  generation_topic   text,
  market_area        text,
  status             text default 'generating' check (status in (
                       'generating','ready','scheduled','partial','archived')),
  posts_generated    int default 0,
  posts_scheduled    int default 0,
  posts_published    int default 0,
  buffer_connected   boolean default false,
  buffer_profile_ids jsonb default '{}',
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);
create index if not exists idx_content_pkg_lo on public.content_packages (lo_id, week_of desc);

alter table public.content_packages enable row level security;
create policy "lo_own_packages" on public.content_packages
  for all using (lo_id = auth.uid());

create table if not exists public.content_posts (
  id               uuid primary key default gen_random_uuid(),
  package_id       uuid not null references public.content_packages(id) on delete cascade,
  org_id           uuid not null references public.organizations(id) on delete cascade,
  lo_id            uuid not null references public.profiles(id),
  platform         text not null check (platform in ('linkedin','instagram','facebook')),
  content_type     text not null,
  post_day         text not null,
  post_text        text not null,
  hashtags         text,
  image_prompt     text,
  nmls_footer      text not null,
  edited_text      text,
  lo_approved      boolean default false,
  scheduled_at     timestamptz,
  buffer_update_id text,
  buffer_status    text,
  published_at     timestamptz,
  status           text default 'draft' check (status in (
                     'draft','edited','approved','scheduled','published','skipped')),
  created_at       timestamptz default now()
);
create index if not exists idx_content_posts_pkg on public.content_posts (package_id);

alter table public.content_posts enable row level security;
create policy "lo_own_posts" on public.content_posts
  for all using (lo_id = auth.uid());
