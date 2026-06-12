-- Phase 92 — Training & Recording Library. A content library (videos/recordings/PDFs/
-- external links) for branch managers to share with LOs. SEPARATE from the existing
-- course LMS (lms_courses/training_courses/training_completions) — namespaced
-- training_item_* to avoid colliding with the module-scoped training_completions.
-- Adapted: uploaded_by/user_id -> profiles(id); org membership via profiles.org_id +
-- role (no org_members table); RLS is a backstop (app uses admin client + role gate).

create table if not exists public.training_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  icon text default 'book',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_training_categories_org on public.training_categories(org_id, sort_order);

create table if not exists public.training_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.training_categories(id) on delete set null,
  uploaded_by uuid references public.profiles(id),
  title text not null,
  description text,
  content_type text not null check (content_type in ('video','audio','pdf','link','recording')),
  storage_path text,
  external_url text,
  duration_seconds integer,
  file_size_bytes bigint,
  tags text[] not null default '{}',
  is_required boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_training_items_org on public.training_items(org_id, is_published);

create table if not exists public.training_item_completions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  training_item_id uuid not null references public.training_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (training_item_id, user_id)
);
create index if not exists idx_training_completions_item on public.training_item_completions(training_item_id);

create table if not exists public.training_item_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  training_item_id uuid not null references public.training_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

alter table public.training_categories enable row level security;
alter table public.training_items enable row level security;
alter table public.training_item_completions enable row level security;
alter table public.training_item_views enable row level security;

-- Completions are idempotent INSERTs (ON CONFLICT DO NOTHING) and views are an append
-- only log — neither is ever updated/deleted.
revoke update, delete, truncate on public.training_item_completions from anon, authenticated, service_role;
revoke update, delete, truncate on public.training_item_views from anon, authenticated, service_role;

-- Private storage bucket for uploaded training files (served via short-lived signed URLs).
insert into storage.buckets (id, name, public)
values ('training-content', 'training-content', false)
on conflict (id) do nothing;
