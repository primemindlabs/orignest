-- Phase 120 — AE Deal Desk (Scenario Pricing Requests)
-- LO requests pricing/exceptions from a lender Account Executive on a specific loan (lead).
-- Distinct from P51 rate_exception_requests (that is the wholesale-AE side / opposite direction).
-- Lead-keyed, org-scoped (RLS inert under Clerk; enforced at app layer).

create table if not exists public.ae_deal_desk_requests (
  id uuid primary key default gen_random_uuid(),
  org_id text not null,
  lo_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade,
  lender_ae_id uuid references public.lender_ae_connections(id) on delete set null,
  -- denormalized AE contact (snapshot, in case connection changes/deletes)
  lender_name text,
  ae_name text,
  ae_email text,
  -- loan parameters being priced
  loan_type text,
  loan_amount numeric,
  ltv numeric,
  fico_score integer,
  property_type text,
  loan_purpose text check (loan_purpose in ('purchase','rate_term_refi','cash_out','dscr','other')),
  occupancy text,
  -- the ask
  requested_rate numeric,
  requested_price numeric,
  lock_period_days integer default 30,
  exception_reason text,
  notes text,
  -- AE response
  ae_offered_rate numeric,
  ae_offered_price numeric,
  ae_response_notes text,
  ae_responded_at timestamptz,
  -- lifecycle
  status text not null default 'draft'
    check (status in ('draft','submitted','in_review','responded','approved','declined','expired')),
  converted_to_scenario_id uuid references public.loan_scenarios(id) on delete set null,
  submitted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ae_deal_desk_requests_org on public.ae_deal_desk_requests(org_id);
create index if not exists idx_ae_deal_desk_requests_lead on public.ae_deal_desk_requests(lead_id);
create index if not exists idx_ae_deal_desk_requests_status on public.ae_deal_desk_requests(org_id, status);

alter table public.ae_deal_desk_requests enable row level security;

-- INSERT-only conversation log
create table if not exists public.ae_deal_desk_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.ae_deal_desk_requests(id) on delete cascade,
  org_id text not null,
  sender_type text not null check (sender_type in ('lo','ae','system')),
  sender_id uuid references public.profiles(id) on delete set null,
  sender_name text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ae_deal_desk_messages_request on public.ae_deal_desk_messages(request_id, created_at);

alter table public.ae_deal_desk_messages enable row level security;

-- INSERT-only: audit/conversation trail must never be mutated
revoke update, delete, truncate on public.ae_deal_desk_messages from authenticated, anon;
