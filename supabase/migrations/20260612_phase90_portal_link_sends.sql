-- Phase 90 — audit log of borrower portal links texted to borrowers (INSERT-only).
-- Adapted to the real stack: lo_id->profiles(id), lead_id->leads(id) (borrowers are
-- leads, not auth.users). delivery distinguishes a real Twilio send from a gated
-- record-only entry (no creds), so the log never implies an SMS that didn't go out.

create table if not exists public.portal_link_sends (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lo_id uuid not null references public.profiles(id),
  lead_id uuid not null references public.leads(id) on delete cascade,
  recipient_phone text,
  portal_token text,
  delivery text not null default 'recorded' check (delivery in ('sent','recorded','failed')),
  error text,
  sent_at timestamptz not null default now()
);
create index if not exists idx_portal_link_sends_lead on public.portal_link_sends(lead_id);
create index if not exists idx_portal_link_sends_org on public.portal_link_sends(org_id);

alter table public.portal_link_sends enable row level security;
revoke update, delete, truncate on public.portal_link_sends from anon, authenticated, service_role;
