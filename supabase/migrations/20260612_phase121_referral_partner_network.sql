-- Phase 121 — Referral Partner Network (attorneys, CPAs, advisors, insurance agents).
-- Brownfield gap-fill: referral_partners already exists (org-scoped: org_id uuid,
-- added_by uuid→profiles, type, closed_count, total_volume, active). We add the
-- public referral-link infra (code + last_outreach_at + specialty) and the two
-- missing tables. Non-Realtor partners get NO portal/Clerk account — external only.

-- 1) Extend referral_partners with referral-link + heat fields.
alter table public.referral_partners add column if not exists referral_code text;
alter table public.referral_partners add column if not exists last_outreach_at timestamptz;
alter table public.referral_partners add column if not exists specialty text;

-- Backfill codes for existing rows, then enforce uniqueness + default for new rows.
update public.referral_partners set referral_code = substr(md5(random()::text || id::text), 1, 8) where referral_code is null;
alter table public.referral_partners alter column referral_code set default substr(md5(random()::text), 1, 8);
create unique index if not exists idx_referral_partners_code on public.referral_partners(referral_code);

-- Add insurance_agent to the existing type CHECK (keeps realtor/builder/cpa/attorney/financial_advisor/other).
alter table public.referral_partners drop constraint if exists referral_partners_type_check;
alter table public.referral_partners add constraint referral_partners_type_check
  check (type = any (array['realtor','builder','cpa','attorney','financial_advisor','insurance_agent','other']));

-- 2) Partner-submitted referrals. Public form inserts; the LO updates status as the
--    loan progresses (mutable — NOT insert-only despite the conceptual "partner can
--    only submit"; the LO owns the lifecycle).
create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  lo_id uuid references public.profiles(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  borrower_first_name text not null,
  borrower_last_name text not null,
  borrower_email text,
  borrower_phone text,
  buying_timeline text,
  referral_notes text,
  referral_source text not null default 'link' check (referral_source in ('link','direct','manual')),
  status text not null default 'new' check (status in ('new','contacted','in_process','funded','declined')),
  submitter_ip_hash text, -- sha256(ip) for public-form rate limiting; no raw IP stored
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_partner_referrals_org on public.partner_referrals(org_id);
create index if not exists idx_partner_referrals_partner on public.partner_referrals(partner_id, created_at);
create index if not exists idx_partner_referrals_ip on public.partner_referrals(submitter_ip_hash, created_at);
alter table public.partner_referrals enable row level security;

-- 3) Partner update-email audit log (INSERT-only).
create table if not exists public.partner_update_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  update_type text not null check (update_type in ('referral_received','pre_approval','under_contract','funded','monthly_summary')),
  resend_message_id text,
  sent_at timestamptz not null default now()
);
create index if not exists idx_partner_update_emails_partner on public.partner_update_emails(partner_id, sent_at);
alter table public.partner_update_emails enable row level security;
revoke update, delete, truncate on public.partner_update_emails from authenticated, anon;
