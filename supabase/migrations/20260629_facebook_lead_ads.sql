-- =============================================================================
-- Facebook / Instagram Lead Ads — real-time lead import
-- =============================================================================
-- Meta delivers a `leadgen` webhook the instant a lead submits a Lead Ad form. We
-- verify the signature, look up the Page → org/LO mapping, pull the lead fields from
-- the Graph API, and create the loan stub IMMEDIATELY (no polling). Mirrors the Arrive
-- inbound pattern (P94): per-connection routing + an INSERT-only import audit.
--
-- facebook_lead_connections — one row per connected Facebook Page (routing key =
--     page_id). Stores the AES-encrypted long-lived Page access token used to read
--     the lead via the Graph API. Leads are assigned to lo_id.
-- facebook_lead_imports — one row per leadgen_id (UNIQUE = dedup backstop); raw
--     payload + mapped fields + status. Never deletable (lead-source audit trail).
-- =============================================================================

create table if not exists public.facebook_lead_connections (
  id                    uuid primary key default gen_random_uuid(),
  org_id                uuid not null references public.organizations(id) on delete cascade,
  lo_id                 uuid references public.profiles(id) on delete set null,  -- assign imported leads here
  page_id               text not null,                                           -- Facebook Page id (routing key)
  page_name             text,
  page_access_token_enc text not null,                                           -- AES-256-GCM encrypted long-lived Page token
  is_active             boolean not null default true,
  last_lead_at          timestamptz,
  last_error            text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (org_id, page_id)
);
create index if not exists idx_fb_lead_conn_page on public.facebook_lead_connections(page_id, is_active);

create table if not exists public.facebook_lead_imports (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  lo_id          uuid references public.profiles(id),
  leadgen_id     text not null unique,                                  -- DB-level dedup backstop
  page_id        text,
  form_id        text,
  lead_id        uuid references public.leads(id) on delete set null,   -- created/matched loan stub
  raw_payload    jsonb,                                                 -- Graph API field_data = source of truth
  first_name     text,
  last_name      text,
  email          text,
  phone          text,
  import_status  text not null default 'pending'
                 check (import_status in ('pending','imported','duplicate','error')),
  error_message  text,
  imported_at    timestamptz not null default now()
);
create index if not exists idx_fb_lead_imports_org on public.facebook_lead_imports(org_id, imported_at desc);

alter table public.facebook_lead_connections enable row level security;
alter table public.facebook_lead_imports       enable row level security;

drop policy if exists "fb_lead_conn_all" on public.facebook_lead_connections;
create policy "fb_lead_conn_all" on public.facebook_lead_connections for all using (org_id = public.get_org_id()) with check (org_id = public.get_org_id());

drop policy if exists "fb_lead_imports_select" on public.facebook_lead_imports;
create policy "fb_lead_imports_select" on public.facebook_lead_imports for select using (org_id = public.get_org_id());
drop policy if exists "fb_lead_imports_insert" on public.facebook_lead_imports;
create policy "fb_lead_imports_insert" on public.facebook_lead_imports for insert with check (org_id = public.get_org_id());

-- Lead-source audit trail — imports are never deletable.
revoke delete, truncate on public.facebook_lead_imports from anon, authenticated, service_role;
