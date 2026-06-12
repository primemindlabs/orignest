-- Phase 94 — Arrive (arrive.app) relocation-concierge lead import.
--
-- Adapted to the real stack:
--   * There is NO `loans` table and borrowers are NOT auth.users. A "loan stub"
--     is a row in `leads`, and the borrower's identity lives on that row.
--   * Routing is PER-LO (each LO has their own Arrive partner account), so the
--     webhook carries ?lo=<profiles.id>. arrive_integrations is keyed by lo_id
--     and also stores org_id so imported leads land in the right tenant.
--   * This Arrive (relocation concierge) is DISTINCT from the Phase 41 "Arive"
--     LOS — different vendor, different tables. Do not conflate.

-- ── Per-LO Arrive integration config ────────────────────────────────────────
create table if not exists public.arrive_integrations (
  lo_id             uuid primary key references public.profiles(id) on delete cascade,
  org_id            uuid not null references public.organizations(id) on delete cascade,
  arrive_partner_id text not null,          -- the LO's id inside Arrive's system
  webhook_secret    text not null,          -- raw secret: the receiver needs it to verify HMAC
                                             -- (plaintext, mirrors los_connections.webhook_secret)
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_arrive_integrations_org on public.arrive_integrations(org_id);

-- Service-role (API) access only. No authenticated policy: the webhook_secret
-- must never be reachable from the browser via PostgREST.
alter table public.arrive_integrations enable row level security;

-- ── Arrive lead import log (INSERT-only audit) ──────────────────────────────
create table if not exists public.arrive_lead_imports (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete cascade,
  lo_id                uuid not null references public.profiles(id),
  arrive_lead_id       text not null unique,                          -- DB-level dedup backstop
  lead_id              uuid references public.leads(id) on delete set null,  -- created/matched loan stub
  arrive_payload       jsonb not null,                                -- raw Arrive JSON = source of truth

  -- Mapped fields (denormalized for reporting)
  first_name           text,
  last_name            text,
  email                text,
  phone                text,
  origin_city          text,
  destination_city     text,
  target_move_date     date,
  estimated_budget     numeric(12,2),
  pre_approved_elsewhere boolean default false,

  import_status        text not null default 'pending'
                       check (import_status in ('pending','imported','duplicate','error')),
  error_message        text,
  imported_at          timestamptz not null default now()
);
create index if not exists idx_arrive_imports_org  on public.arrive_lead_imports(org_id);
create index if not exists idx_arrive_imports_lo   on public.arrive_lead_imports(lo_id);
create index if not exists idx_arrive_imports_lead on public.arrive_lead_imports(lead_id);

alter table public.arrive_lead_imports enable row level security;
-- INSERT-only: never mutate or delete an import record.
revoke update, delete, truncate on public.arrive_lead_imports from anon, authenticated, service_role;

-- ── Back-link Arrive-sourced loans on the lead itself ───────────────────────
-- Enables dedup, Phase 98 referral ROI grouping, and the "pre-warm for 7 days"
-- morning-brief priority window (Phase 81).
alter table public.leads add column if not exists arrive_lead_id     text;
alter table public.leads add column if not exists arrive_imported_at timestamptz;
create index if not exists idx_leads_arrive on public.leads(org_id, arrive_lead_id)
  where arrive_lead_id is not null;
