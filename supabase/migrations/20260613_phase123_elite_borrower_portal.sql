-- Phase 123 — Elite Borrower Portal (8 features). Adapted to the real stack:
-- the borrower portal is TOKEN-based (borrower_portal_tokens → lead), NOT Supabase auth.
-- So every spec `borrower_id uuid REFERENCES auth.users` + `loan_id REFERENCES loans`
-- becomes lead-keyed + org-scoped (lead = the loan + borrower). RLS is enabled for
-- parity but access is via the service-role admin client inside token-gated handlers
-- (the app authenticates borrowers by unguessable token, not a Supabase JWT).

-- 1) Canonical tracker stages (global seed, not per-loan).
create table if not exists public.loan_tracker_stages (
  id uuid primary key default gen_random_uuid(),
  stage_order integer not null unique,
  stage_key text not null unique,
  stage_label text not null,
  stage_description text,
  icon text default 'ti-circle-check',
  created_at timestamptz default now()
);
insert into public.loan_tracker_stages (stage_order, stage_key, stage_label, stage_description) values
  (1, 'application_received', 'Application received', 'Your application is in our system'),
  (2, 'documents_verified', 'Documents verified', 'All required documents confirmed complete'),
  (3, 'initial_approval', 'Initial approval', 'Loan officer has reviewed and approved'),
  (4, 'appraisal_ordered', 'Appraisal ordered', 'Property appraisal has been ordered'),
  (5, 'clear_to_close', 'Clear to close', 'Underwriting complete, ready for closing'),
  (6, 'closing_scheduled', 'Closing scheduled', 'Closing date and time confirmed')
on conflict (stage_order) do nothing;

-- 2) Per-loan stage progress (lead-keyed).
create table if not exists public.loan_stage_progress (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  org_id uuid not null,
  current_stage_order integer not null default 1,
  current_stage_pct integer not null default 0 check (current_stage_pct between 0 and 100),
  stage_reached_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (lead_id)
);
alter table public.loan_stage_progress enable row level security;

-- 3) Celebration state (show once).
create table if not exists public.loan_celebration_states (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  org_id uuid not null,
  celebration_type text not null check (celebration_type in ('under_contract','funded')),
  shown_at timestamptz,
  created_at timestamptz default now(),
  unique (lead_id, celebration_type)
);
alter table public.loan_celebration_states enable row level security;

-- 4) Ask Ashley conversations (INSERT-only).
create table if not exists public.ashley_conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  org_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  question_category text,
  tokens_used integer,
  created_at timestamptz default now()
);
create index if not exists idx_ashley_conversations_lead on public.ashley_conversations(lead_id, created_at);
alter table public.ashley_conversations enable row level security;
revoke update, delete, truncate on public.ashley_conversations from authenticated, anon;

-- 5) Mortgage health scores (INSERT-only snapshots).
create table if not exists public.mortgage_health_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  org_id uuid not null,
  score integer not null check (score between 0 and 100),
  credit_score integer,
  equity_estimate numeric(12,2),
  current_rate numeric(5,3),
  market_rate numeric(5,3),
  rate_comparison_delta numeric(5,3),
  action_items jsonb not null default '[]',
  computed_at timestamptz default now()
);
create index if not exists idx_mortgage_health_lead on public.mortgage_health_scores(lead_id, computed_at desc);
alter table public.mortgage_health_scores enable row level security;
revoke update, delete, truncate on public.mortgage_health_scores from authenticated, anon;

-- 6) Home wealth snapshots (INSERT-only time series; equity is generated).
create table if not exists public.home_wealth_snapshots (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  org_id uuid not null,
  home_value numeric(12,2) not null,
  mortgage_balance numeric(12,2) not null,
  equity numeric(12,2) generated always as (home_value - mortgage_balance) stored,
  monthly_appreciation numeric(10,2),
  net_worth_growth_ytd numeric(12,2),
  data_source text default 'manual',
  snapshot_date date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists idx_home_wealth_lead on public.home_wealth_snapshots(lead_id, snapshot_date desc);
alter table public.home_wealth_snapshots enable row level security;
revoke update, delete, truncate on public.home_wealth_snapshots from authenticated, anon;

-- 7) Real estate portfolio (investor borrowers; cash flow generated).
create table if not exists public.borrower_properties (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  org_id uuid not null,
  address text not null,
  property_type text default 'single_family',
  purchase_price numeric(12,2),
  current_value numeric(12,2),
  mortgage_balance numeric(12,2),
  monthly_rent numeric(10,2),
  monthly_expenses numeric(10,2),
  monthly_cash_flow numeric(10,2) generated always as (coalesce(monthly_rent,0) - coalesce(monthly_expenses,0)) stored,
  is_primary_residence boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_borrower_properties_lead on public.borrower_properties(lead_id);
alter table public.borrower_properties enable row level security;

-- 8) Closing vault (permanent — no delete ever).
create table if not exists public.closing_vault_documents (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete restrict,
  org_id uuid not null,
  document_type text not null,
  document_label text not null,
  storage_path text not null,
  file_size_bytes integer,
  uploaded_by text default 'system',
  uploaded_at timestamptz default now()
);
create index if not exists idx_closing_vault_lead on public.closing_vault_documents(lead_id, uploaded_at desc);
alter table public.closing_vault_documents enable row level security;
revoke update, delete, truncate on public.closing_vault_documents from authenticated, anon;

-- 9) Annual mortgage review log (INSERT-only).
create table if not exists public.annual_mortgage_reviews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  org_id uuid not null,
  review_year integer not null,
  equity_gained numeric(12,2),
  current_home_value numeric(12,2),
  current_rate numeric(5,3),
  market_rate numeric(5,3),
  refi_savings_potential numeric(10,2),
  new_products jsonb default '[]',
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz default now(),
  unique (lead_id, review_year)
);
alter table public.annual_mortgage_reviews enable row level security;
revoke update, delete, truncate on public.annual_mortgage_reviews from authenticated, anon;
