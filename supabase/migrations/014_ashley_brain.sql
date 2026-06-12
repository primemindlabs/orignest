-- =============================================================================
-- 014_ashley_brain.sql  —  Phase 127: Ashley Brain (relationship memory + RAG)
-- =============================================================================
-- Source spec: primemind-strategy/build-prompts/prompt-ashleyiq-phase-127-ashley-brain.md
--
-- ADAPTED to the real Ashley IQ schema (Clerk auth, not Supabase auth):
--   * users(id)            -> profiles(id)   (no `users` table in this app)
--   * branch-manager RLS uses profiles.role (real, present today) instead of
--     user_roles, which is created later in 020_role_architecture.sql.
--   * Access is enforced primarily by the server-side admin (service-role)
--     client behind Clerk getOrgContext — the service role BYPASSES RLS, so the
--     auth.uid() policies below harden direct PostgREST/anon access only.
--   * INSERT-only guarantees are enforced for real via REVOKE (works against all
--     roles incl. service_role), matching the repo's audit-table convention.
-- NOTE: this file's numeric prefix sorts BEFORE the 2026*-dated base migrations;
-- it assumes organizations/profiles already exist (true on the live DB).

create extension if not exists vector;

-- ── Memories: distilled relationship facts (mutable: can be superseded) ──────
create table if not exists public.ashley_brain_memories (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  lo_id         uuid not null references public.profiles(id) on delete cascade,
  entity_type   text not null check (entity_type in ('borrower','realtor','lender_ae','referral_partner')),
  entity_id     uuid not null,
  memory_type   text not null check (memory_type in (
                  'relationship_fact','preference','goal','objection',
                  'lender_preference','life_event','communication_style','referral_intel')),
  memory_text   text not null,
  source        text not null check (source in (
                  'call_note','meeting_note','portal_chat','sms','email','lo_input','autopilot_outcome')),
  source_id     uuid,
  confidence    float default 1.0 check (confidence >= 0.0 and confidence <= 1.0),
  is_active     boolean default true,
  superseded_by uuid references public.ashley_brain_memories(id),
  extracted_at  timestamptz default now(),
  created_at    timestamptz default now()
);
create index if not exists idx_brain_mem_entity on public.ashley_brain_memories (lo_id, entity_type, entity_id) where is_active = true;
create index if not exists idx_brain_mem_org_type on public.ashley_brain_memories (org_id, entity_type, entity_id, memory_type) where is_active = true;

alter table public.ashley_brain_memories enable row level security;
-- LOs see only their own memories.
create policy "lo_own_memories" on public.ashley_brain_memories
  for all using (lo_id = auth.uid());
-- Branch managers / admins read all memories in their org (role via profiles).
create policy "branch_manager_org_memories" on public.ashley_brain_memories
  for select using (
    org_id in (select p.org_id from public.profiles p
               where p.id = auth.uid() and p.role in ('branch_manager','admin')));

-- ── Logs: raw interaction record. INSERT + SELECT only. Never UPDATE/DELETE. ─
create table if not exists public.ashley_brain_logs (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id),
  lo_id                uuid not null references public.profiles(id),
  entity_type          text check (entity_type in ('borrower','realtor','lender_ae','referral_partner')),
  entity_id            uuid,
  log_type             text not null check (log_type in (
                         'call_note','meeting_note','portal_chat','sms_sent','sms_received',
                         'email_sent','email_received','lo_note','autopilot_outcome')),
  content              text not null,
  raw_metadata         jsonb default '{}',
  processed            boolean default false,
  processed_at         timestamptz,
  extracted_memory_ids uuid[],
  created_at           timestamptz default now()
);
alter table public.ashley_brain_logs enable row level security;
create policy "lo_insert_own_logs" on public.ashley_brain_logs
  for insert with check (lo_id = auth.uid());
create policy "lo_read_own_logs" on public.ashley_brain_logs
  for select using (lo_id = auth.uid());
-- NO UPDATE POLICY. NO DELETE POLICY. EVER. Hard-enforced:
revoke update, delete, truncate on public.ashley_brain_logs from anon, authenticated, service_role;

-- ── Embeddings: pgvector store for semantic recall ──────────────────────────
create table if not exists public.ashley_brain_embeddings (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  lo_id        uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in (
                 'memory','call_note','meeting_note','sms_thread','portal_chat','lo_note')),
  content_id   uuid not null,
  entity_type  text,
  entity_id    uuid,
  content_text text not null,
  embedding    vector(1536),
  created_at   timestamptz default now()
);
create index if not exists idx_brain_emb_ivfflat on public.ashley_brain_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_brain_emb_entity on public.ashley_brain_embeddings (lo_id, entity_type, entity_id);

alter table public.ashley_brain_embeddings enable row level security;
create policy "lo_own_embeddings" on public.ashley_brain_embeddings
  for all using (lo_id = auth.uid());

-- ── Vector similarity search RPC ────────────────────────────────────────────
create or replace function public.search_brain(
  p_lo_id uuid,
  p_query_embedding vector(1536),
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_limit int default 10,
  p_match_threshold float default 0.75
)
returns table (
  content_id uuid, content_type text, entity_type text,
  entity_id uuid, content_text text, similarity float
)
language sql stable
as $$
  select e.content_id, e.content_type, e.entity_type, e.entity_id, e.content_text,
         1 - (e.embedding <=> p_query_embedding) as similarity
  from public.ashley_brain_embeddings e
  where e.lo_id = p_lo_id
    and (p_entity_type is null or e.entity_type = p_entity_type)
    and (p_entity_id is null or e.entity_id = p_entity_id)
    and 1 - (e.embedding <=> p_query_embedding) > p_match_threshold
  order by e.embedding <=> p_query_embedding
  limit p_limit;
$$;
