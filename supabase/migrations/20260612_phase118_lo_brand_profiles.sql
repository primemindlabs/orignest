-- =============================================================================
-- Phase 118 — Co-Marketing Materials Generator
-- =============================================================================
-- Reuses the existing co_marketing_materials (org_id, created_by, partner_id,
-- material_type, content jsonb, preview_html) and realtors (P40) — only adds the LO
-- brand profile used to co-brand generated materials.
-- Adapted: lo_id (auth.users) -> org_id + user_id (profiles.id), one per user.

create table if not exists public.lo_brand_profiles (
  id                         uuid primary key default gen_random_uuid(),
  org_id                     uuid not null references public.organizations(id) on delete cascade,
  user_id                    uuid not null references public.profiles(id) on delete cascade,
  headshot_storage_path      text,
  company_logo_storage_path  text,
  brand_color                text not null default '#C9A95C',
  tagline                    text,
  phone_display              text,
  website_url                text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (org_id, user_id)
);

alter table public.lo_brand_profiles enable row level security;
