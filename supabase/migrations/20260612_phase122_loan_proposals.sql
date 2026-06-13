-- Phase 122 — AI Loan Proposal Generator.
-- Adapted to the real stack: lo_id→profiles, loan_id→lead_id (leads = the loan/borrower),
-- borrower is the lead (no auth.users borrower). No @react-pdf installed → the proposal
-- is a print-friendly public HTML page at /proposal/[share_token] (browser print-to-PDF),
-- mirroring Phase 115's scenario-compare approach. Proposals are NEVER deleted (audit trail).

create table if not exists public.loan_proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  lo_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete cascade,
  recommended_scenario_id uuid not null references public.loan_scenarios(id) on delete restrict,
  comparison_scenario_ids uuid[] not null default '{}',
  -- Claude Haiku-generated content (stored for re-use / re-render)
  executive_summary text,
  recommendation_rationale text,
  market_context text,
  next_steps text,
  -- public share link (token IS the credential for the borrower-facing page)
  share_token text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 16),
  -- delivery + outcome tracking
  sent_at timestamptz,
  sent_channel text check (sent_channel in ('email','sms')),
  viewed_at timestamptz,
  borrower_choice_scenario_id uuid references public.loan_scenarios(id) on delete set null,
  borrower_choice_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_loan_proposals_org on public.loan_proposals(org_id);
create index if not exists idx_loan_proposals_lead on public.loan_proposals(lead_id, created_at);
create unique index if not exists idx_loan_proposals_token on public.loan_proposals(share_token);

alter table public.loan_proposals enable row level security;

-- Never deleted: the full proposal history is an audit trail. UPDATE stays allowed
-- (sent_at / viewed_at / borrower choice are tracked over the proposal's life).
revoke delete, truncate on public.loan_proposals from authenticated, anon;
