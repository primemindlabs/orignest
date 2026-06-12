-- =============================================================================
-- 015_autopilot.sql  —  Phase 128: Ashley Autopilot (approve-to-send action queue)
-- =============================================================================
-- Source spec: primemind-strategy/build-prompts/prompt-ashleyiq-phase-128-ashley-autopilot.md
-- ADAPTED: users(id)->profiles(id); loans(id)->leads(id) (loans are leads here);
-- branch-manager RLS via profiles.role (user_roles arrives in 020). auth.uid()
-- policies harden direct access; the app reads/writes via the service-role admin
-- client. autopilot_audit_log is INSERT+SELECT only (REVOKE enforced).

create table if not exists public.autopilot_actions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations(id),
  lo_id               uuid not null references public.profiles(id),
  action_type         text not null check (action_type in (
                        'send_sms','send_email','internal_alert','trigger_workflow','schedule_call_reminder')),
  signal_type         text not null,
  signal_reason       text not null,
  recommended_content text,
  recommended_subject text,
  entity_type         text not null check (entity_type in ('borrower','realtor','lender_ae','referral_partner')),
  entity_id           uuid not null,
  entity_name         text not null,
  loan_id             uuid references public.leads(id),
  status              text not null default 'pending' check (status in (
                        'pending','approved','executing','executed','rejected','undone','expired')),
  approved_at         timestamptz,
  approved_by         uuid references public.profiles(id),
  executed_at         timestamptz,
  undo_deadline       timestamptz,
  undo_used_at        timestamptz,
  rejected_at         timestamptz,
  rejection_reason    text,
  generated_at        timestamptz default now(),
  generated_date      date default current_date,
  priority            int default 5,
  created_at          timestamptz default now()
);
create index if not exists idx_autopilot_today on public.autopilot_actions (lo_id, generated_date, status);
create index if not exists idx_autopilot_prio on public.autopilot_actions (lo_id, status, priority);

alter table public.autopilot_actions enable row level security;
-- LOs see their own queue and may approve/reject (status UPDATE) their own actions.
create policy "lo_own_queue" on public.autopilot_actions
  for select using (lo_id = auth.uid());
create policy "lo_update_status" on public.autopilot_actions
  for update using (lo_id = auth.uid()) with check (lo_id = auth.uid());
-- Branch managers / admins read their org's queue (role via profiles).
create policy "branch_manager_read_team" on public.autopilot_actions
  for select using (
    org_id in (select p.org_id from public.profiles p
               where p.id = auth.uid() and p.role in ('branch_manager','admin')));
-- INSERT is server-side (action generation) via the service-role client.

-- ── Audit log: INSERT + SELECT only. No UPDATE. No DELETE. EVER. ─────────────
create table if not exists public.autopilot_audit_log (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organizations(id),
  lo_id                    uuid not null references public.profiles(id),
  autopilot_action_id      uuid not null references public.autopilot_actions(id),
  event                    text not null check (event in (
                             'generated','approved','rejected','executed',
                             'undo_requested','undo_completed','expired')),
  event_metadata           jsonb default '{}',
  tcpa_consent_verified    boolean,
  nmls_disclaimer_injected boolean,
  created_at               timestamptz default now()
);
create index if not exists idx_autopilot_audit_action on public.autopilot_audit_log (autopilot_action_id);
alter table public.autopilot_audit_log enable row level security;
create policy "insert_own_audit" on public.autopilot_audit_log
  for insert with check (lo_id = auth.uid());
create policy "read_own_audit" on public.autopilot_audit_log
  for select using (lo_id = auth.uid());
revoke update, delete, truncate on public.autopilot_audit_log from anon, authenticated, service_role;
