-- =============================================================================
-- 020_role_architecture.sql  —  Phase 133: Role Architecture (LO / LOA / Processor)
-- =============================================================================
-- Source spec: primemind-strategy/build-prompts/prompt-ashleyiq-phase-133-role-architecture.md
--
-- ADAPTED to the real schema:
--   * users(id)   -> profiles(id)
--   * loans       -> leads   (loans are leads; the LO on a lead is leads.assigned_to, not lo_id)
--   * conditions  -> loan_conditions  (scoped by loan_conditions.lead_id)
--   * borrowers   -> NO such table; the borrower record IS the lead, so the LOA
--                    borrower-visibility rule is covered by the loans(leads) policy below.
--   * comp_plans  -> real (has lo_id, org_id).
-- New tables are created first so the policies below can reference them. auth.uid()
-- policies harden direct PostgREST access; the app authorizes via the service-role
-- admin client (Clerk) which bypasses RLS. Policies added to existing RLS-enabled
-- tables are additive (PERMISSIVE / OR-combined).

-- ── user_roles ──────────────────────────────────────────────────────────────
create table if not exists public.user_roles (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  role           text not null check (role in ('lo','loa','processor','branch_manager','admin')),
  assigned_lo_id uuid references public.profiles(id),   -- for LOA: which LO they assist
  is_active      boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (org_id, user_id, role)
);
alter table public.user_roles enable row level security;
create policy "user_read_own_role" on public.user_roles
  for select using (user_id = auth.uid());
create policy "admin_manage_roles" on public.user_roles
  for all using (
    org_id in (select ur.org_id from public.user_roles ur
               where ur.user_id = auth.uid() and ur.role = 'admin'));

-- ── loan_processor_assignments ──────────────────────────────────────────────
create table if not exists public.loan_processor_assignments (
  id           uuid primary key default gen_random_uuid(),
  loan_id      uuid not null references public.leads(id) on delete cascade,
  processor_id uuid not null references public.profiles(id),
  org_id       uuid not null references public.organizations(id),
  assigned_by  uuid not null references public.profiles(id),
  assigned_at  timestamptz default now(),
  is_active    boolean default true
);
create index if not exists idx_lpa_processor on public.loan_processor_assignments (processor_id, is_active);
create index if not exists idx_lpa_loan on public.loan_processor_assignments (loan_id);
alter table public.loan_processor_assignments enable row level security;
create policy "processor_own_assignments" on public.loan_processor_assignments
  for select using (processor_id = auth.uid());
-- LO can assign/unassign processors for their own loans (leads.assigned_to = the LO).
create policy "lo_manage_assignments" on public.loan_processor_assignments
  for all using (loan_id in (select id from public.leads where assigned_to = auth.uid()));

-- ── loa_communication_drafts ────────────────────────────────────────────────
-- LOA drafts a message; the LO reviews and sends. INSERT by LOA, status UPDATE by LO.
create table if not exists public.loa_communication_drafts (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  loa_id         uuid not null references public.profiles(id),
  lo_id          uuid not null references public.profiles(id),
  loan_id        uuid references public.leads(id),
  contact_id     uuid not null,
  draft_type     text not null check (draft_type in ('sms','email')),
  draft_text     text not null,
  draft_subject  text,
  status         text default 'pending_review' check (status in (
                   'pending_review','approved_sent','rejected','edited_sent')),
  lo_reviewed_at timestamptz,
  created_at     timestamptz default now()
);
create index if not exists idx_loa_drafts_lo on public.loa_communication_drafts (lo_id, status);
alter table public.loa_communication_drafts enable row level security;
create policy "loa_insert_draft" on public.loa_communication_drafts
  for insert with check (loa_id = auth.uid());
create policy "loa_lo_read_draft" on public.loa_communication_drafts
  for select using (loa_id = auth.uid() or lo_id = auth.uid());
create policy "lo_update_draft_status" on public.loa_communication_drafts
  for update using (lo_id = auth.uid()) with check (lo_id = auth.uid());
-- Drafts are an audit of LOA→LO handoffs; never hard-deleted.
revoke delete, truncate on public.loa_communication_drafts from anon, authenticated, service_role;

-- ── RLS additions on existing tables ────────────────────────────────────────
-- leads (= the spec's `loans` AND `borrowers`): LOA sees their assigned LO's
-- loans; processors see only loans assigned to them.
alter table public.leads enable row level security;
create policy "loa_view_assigned_lo_loans" on public.leads
  for select using (
    assigned_to in (select ur.assigned_lo_id from public.user_roles ur
                    where ur.user_id = auth.uid() and ur.role = 'loa' and ur.is_active = true));
create policy "processor_view_assigned_loans" on public.leads
  for select using (
    id in (select lpa.loan_id from public.loan_processor_assignments lpa
           where lpa.processor_id = auth.uid() and lpa.is_active = true));

-- loan_conditions (= the spec's `conditions`): processors may update conditions
-- on loans assigned to them (loan_conditions.lead_id is the loan key).
alter table public.loan_conditions enable row level security;
create policy "processor_update_assigned_conditions" on public.loan_conditions
  for update using (
    lead_id in (select lpa.loan_id from public.loan_processor_assignments lpa
                where lpa.processor_id = auth.uid() and lpa.is_active = true));

-- comp_plans: compensation visible only to the owning LO and branch managers/admins.
alter table public.comp_plans enable row level security;
create policy "comp_data_restricted" on public.comp_plans
  for select using (
    lo_id = auth.uid()
    or auth.uid() in (select ur.user_id from public.user_roles ur
                      where ur.org_id = comp_plans.org_id and ur.role in ('branch_manager','admin')));

-- An LOA invite names the LO they will assist (applied to user_roles on accept).
alter table public.invitations add column if not exists assigned_lo_id uuid references public.profiles(id);
