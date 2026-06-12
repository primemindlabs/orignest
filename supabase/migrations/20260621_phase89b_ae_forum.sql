-- Phase 89b — AE Forum. Branch (= org) Q&A board: an MLO posts a question, it's emailed
-- to AEs from their Phase 89 directory, and AE answers become an org-wide knowledge base.
-- "branch" maps to org_id (no branches table in this codebase). Posts/responses/comments
-- are permanent knowledge records; responses + comments are strictly INSERT-only, posts
-- allow only the narrow author best-answer/resolve update.

create table if not exists public.ae_forum_posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  posted_by uuid not null references public.profiles(id),
  category text not null default 'general' check (category in ('program','pricing','guideline','special','general')),
  title text not null,
  body text,
  notified_ae_ids uuid[] not null default '{}',
  is_resolved boolean not null default false,
  best_response_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_ae_forum_posts_org on public.ae_forum_posts(org_id, created_at desc);

create table if not exists public.ae_forum_responses (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.ae_forum_posts(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  lender_ae_id uuid references public.lender_ae_connections(id) on delete set null,
  ae_name text,                                   -- snapshot for inbound replies w/o a directory match
  body text not null,
  source text not null default 'manual' check (source in ('manual','email')),
  email_message_id text,
  added_by uuid references public.profiles(id),   -- who keyed a manual response
  created_at timestamptz not null default now()
);
create index if not exists idx_ae_forum_responses_post on public.ae_forum_responses(post_id, created_at);

create table if not exists public.ae_forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.ae_forum_posts(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ae_forum_comments_post on public.ae_forum_comments(post_id, created_at);

create table if not exists public.ae_forum_stars (
  user_id uuid not null references public.profiles(id) on delete cascade,
  response_id uuid not null references public.ae_forum_responses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, response_id)
);

create table if not exists public.ae_forum_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.ae_forum_posts(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.ae_forum_posts add constraint fk_ae_forum_best_response
  foreign key (best_response_id) references public.ae_forum_responses(id) deferrable initially deferred;

alter table public.ae_forum_posts enable row level security;
alter table public.ae_forum_responses enable row level security;
alter table public.ae_forum_comments enable row level security;
alter table public.ae_forum_stars enable row level security;
alter table public.ae_forum_reads enable row level security;

-- Knowledge content is permanent. Responses + comments are INSERT-only for every role
-- (incl. service_role). Posts allow UPDATE (author best-answer/resolve only, enforced in
-- the route) but never DELETE.
revoke update, delete, truncate on public.ae_forum_responses from anon, authenticated, service_role;
revoke update, delete, truncate on public.ae_forum_comments from anon, authenticated, service_role;
revoke delete, truncate on public.ae_forum_posts from anon, authenticated, service_role;
