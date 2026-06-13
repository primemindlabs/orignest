-- =============================================================================
-- Phase 109 — In-File Internal Chat
-- =============================================================================
-- Per-loan INTERNAL team chat (LO + processors/LOAs/branch managers; borrowers never
-- see it). Built on the EXISTING chat stack (chat_messages / loan_chat_threads /
-- chat_read_receipts) rather than the spec's new loan_chat_messages + loan_chat_watchers
-- (which referenced a non-existent `loans` table). Per the chosen approach:
--   * Internal messages live in their OWN thread (loan_chat_threads.is_internal=true),
--     so they never leak into the external multi-party LO chat (whose GET returns the
--     whole external thread). getOrCreateThread now filters is_internal=false, keeping
--     the external/borrower/realtor/title chat unchanged.
--   * "Watchers" are DERIVED from existing data (assigned LO + loan_processor_assignments
--     + LOAs via user_roles.assigned_lo_id + branch_manager/admin) — no watchers table.
--   * sender_type / reader_type checks widened to allow 'internal'.

alter table public.loan_chat_threads
  add column if not exists is_internal boolean not null default false;

-- A loan previously allowed exactly ONE thread (unique lead_id+org_id). Widen the
-- uniqueness to include is_internal so the external thread and the new internal
-- thread can coexist (still one of each kind per loan).
alter table public.loan_chat_threads drop constraint if exists loan_chat_threads_lead_id_org_id_key;
create unique index if not exists loan_chat_threads_lead_org_kind_key
  on public.loan_chat_threads (lead_id, org_id, is_internal);

-- Widen sender_type to allow internal team messages.
alter table public.chat_messages drop constraint if exists chat_messages_sender_type_check;
alter table public.chat_messages add constraint chat_messages_sender_type_check
  check (sender_type in ('lo','borrower','coborrower','realtor','title_agent','system','internal'));

-- Widen reader_type for internal read receipts.
alter table public.chat_read_receipts drop constraint if exists chat_read_receipts_reader_type_check;
alter table public.chat_read_receipts add constraint chat_read_receipts_reader_type_check
  check (reader_type in ('lo','borrower','coborrower','realtor','title_agent','internal'));
