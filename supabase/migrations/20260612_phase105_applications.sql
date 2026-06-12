-- =============================================================================
-- Phase 105 — Smart 1003 Digital Application
-- =============================================================================
-- Public token-gated form (no login). Adapted to the real stack:
--   * Added org_id (Clerk org scoping; set at creation from the lead's org). Public
--     read/write goes through the service-role admin client gated by the token — the
--     same pattern as the certificate / title-portal public pages. RLS inert.
--   * `application_sessions` (Phase 97 abandon-recovery) already exists; the apply
--     flow updates it best-effort (it is keyed by `token`, not lead_id).
--   * CRM sync runs in the submit route (TS), mapping to the REAL leads columns
--     (first_name/last_name/phone/email; stage 'new_inquiry' -> 'application') — not
--     a plpgsql function, and NOT the spec's borrower_* columns (which don't exist).
--   * SSN: only last-4 stored, never the full number.

create table if not exists public.applications (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references public.organizations(id) on delete cascade,
  lead_id                     uuid not null references public.leads(id) on delete cascade,
  token                       text unique not null default encode(gen_random_bytes(20), 'hex'),
  status                      text not null default 'draft'
                                check (status in ('draft','in_progress','submitted','reviewed')),

  -- Personal
  borrower_first_name         text,
  borrower_last_name          text,
  borrower_dob                date,
  borrower_ssn_last4          text,
  borrower_phone              text,
  borrower_email              text,
  sms_consent                 boolean not null default false,
  co_borrower                 boolean not null default false,
  coborrower_first_name       text,
  coborrower_last_name        text,
  coborrower_dob              date,
  coborrower_ssn_last4        text,
  coborrower_phone            text,
  coborrower_email            text,

  -- Employment
  employment_type             text check (employment_type in ('employed','self_employed','retired','other')),
  employer_name               text,
  job_title                   text,
  years_at_job                numeric(3,1),
  gross_monthly_income        numeric(12,2),
  self_emp_business_name      text,
  self_emp_years              int,
  self_emp_monthly_net        numeric(12,2),
  monthly_retirement_income   numeric(12,2),

  -- Property
  property_address            text,
  property_city               text,
  property_state              char(2),
  property_zip                text,
  property_type               text check (property_type in ('primary','investment','second_home')),
  purchase_price              numeric(12,2),
  estimated_value             numeric(12,2),
  loan_purpose                text check (loan_purpose in ('purchase','refinance','cash_out')),

  -- Loan preferences
  desired_loan_amount         numeric(12,2),
  loan_type_preference        text,
  down_payment_amount         numeric(12,2),
  down_payment_source         text,

  -- Assets
  checking_balance            numeric(12,2),
  savings_balance             numeric(12,2),
  retirement_balance          numeric(12,2),
  other_assets                numeric(12,2),
  monthly_debts               numeric(10,2),

  -- HMDA (collected with ECOA/HMDA disclosure)
  hmda_race                   text,
  hmda_ethnicity              text,
  hmda_sex                    text,
  hmda_collected_at           timestamptz,

  -- Declarations
  declaration_bankruptcy      boolean,
  declaration_foreclosure     boolean,
  declaration_lawsuit         boolean,
  declaration_delinquent      boolean,
  declaration_alimony         boolean,
  declaration_borrowed_down   boolean,
  declaration_us_citizen      boolean,
  declaration_primary_res     boolean,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  submitted_at                timestamptz,
  ip_address                  text,
  user_agent                  text
);
create index if not exists idx_applications_lead   on public.applications(lead_id);
create index if not exists idx_applications_org     on public.applications(org_id);
create index if not exists idx_applications_status  on public.applications(status);

create table if not exists public.application_section_progress (
  application_id  uuid not null references public.applications(id) on delete cascade,
  section_name    text not null check (section_name in (
    'personal','employment','property','loan','assets','hmda','declarations','review')),
  completed       boolean not null default false,
  completed_at    timestamptz,
  primary key (application_id, section_name)
);

alter table public.applications enable row level security;
alter table public.application_section_progress enable row level security;
