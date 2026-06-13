-- =============================================================================
-- Phase 119 — Borrower Identity Verification (BSA/AML)
-- =============================================================================
-- Adapted to the real stack: the borrower portal is token-based (no borrower login),
-- so verification is keyed on lead_id (borrower = lead) + org_id + lo_id (assigned LO).
-- SSN last-4 is NEVER stored — validated in the flow and discarded; only the result
-- persists. ID docs go in the existing private `borrower-docs` bucket (identity/ prefix).

create table if not exists public.identity_verifications (
  id                              uuid primary key default gen_random_uuid(),
  org_id                          uuid not null references public.organizations(id) on delete cascade,
  lead_id                         uuid not null references public.leads(id) on delete cascade,
  lo_id                           uuid references public.profiles(id) on delete set null,

  status                          text not null default 'pending'
    check (status in ('pending','in_review','verified','failed','manual_review')),
  verification_method             text not null default 'basic'
    check (verification_method in ('basic','stripe_identity','lo_manual')),

  id_document_path                text,
  id_document_type                text,

  match_score                     numeric(5,2),
  failure_reason                  text,

  stripe_verification_session_id  text,
  stripe_verification_report      jsonb,

  manually_verified_by            uuid references public.profiles(id) on delete set null,
  manually_verified_at            timestamptz,
  manual_verification_notes       text,

  submitted_at                    timestamptz,
  verified_at                     timestamptz,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (lead_id)
);
create index if not exists idx_identity_verifications_org on public.identity_verifications (org_id, status);

-- INSERT-only audit (every event, including failures). performed_by = LO profile;
-- NULL for borrower-initiated events (the borrower has no profile).
create table if not exists public.identity_verification_events (
  id               uuid primary key default gen_random_uuid(),
  verification_id  uuid not null references public.identity_verifications(id) on delete cascade,
  org_id           uuid not null references public.organizations(id) on delete cascade,
  event_type       text not null,
  performed_by     uuid references public.profiles(id) on delete set null,
  ip_address       text,
  user_agent       text,
  details          jsonb,
  occurred_at      timestamptz not null default now()
);
create index if not exists idx_identity_events_verification on public.identity_verification_events (verification_id, occurred_at desc);

alter table public.identity_verifications enable row level security;
alter table public.identity_verification_events enable row level security;
revoke update, delete, truncate on public.identity_verification_events from anon, authenticated, service_role;
