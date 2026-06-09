-- ============================================================
-- Ashley IQ — Phase 31 · Wave 1: 3-Way Chat
-- 2026-06-09
--
-- One unified thread per loan: LO ↔ Borrower(+Co) ↔ Realtor, with per-message
-- visibility the LO controls. Translated to real schema:
--   tenant_id -> org_id; users -> profiles; auth.uid() RLS -> get_org_id();
--   portal_tokens -> borrower_portal_tokens; "funded" stage -> 'closed'.
--
-- Live updates use client polling (the app authenticates with Clerk, not
-- Supabase, so the anon client sends no Supabase JWT — RLS-filtered Realtime
-- postgres_changes would return nothing). Realtime publication is intentionally
-- not enabled here.
-- ============================================================

-- One thread per loan.
CREATE TABLE IF NOT EXISTS loan_chat_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           uuid REFERENCES profiles(id),
  borrower_in_thread   boolean NOT NULL DEFAULT false,
  coborrower_in_thread boolean NOT NULL DEFAULT false,
  realtor_in_thread    boolean NOT NULL DEFAULT false,
  realtor_portal_id    uuid REFERENCES portal_realtors(id) ON DELETE SET NULL,
  realtor_sees_borrower_messages boolean NOT NULL DEFAULT false,
  title_agent_in_thread  boolean NOT NULL DEFAULT false,
  title_agent_portal_id  uuid,   -- FK added in Wave 3 (portal_title_agents)
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_lct_lead ON loan_chat_threads(lead_id, org_id);
ALTER TABLE loan_chat_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lct_select" ON loan_chat_threads;
CREATE POLICY "lct_select" ON loan_chat_threads FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "lct_write" ON loan_chat_threads;
CREATE POLICY "lct_write" ON loan_chat_threads FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- Messages.
CREATE TABLE IF NOT EXISTS chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       uuid NOT NULL REFERENCES loan_chat_threads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_type     text NOT NULL CHECK (sender_type IN ('lo','borrower','coborrower','realtor','title_agent','system')),
  sender_id       uuid,
  content         text NOT NULL,
  content_type    text NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','document_request','milestone_update','system','action_required')),
  document_id     uuid REFERENCES documents(id) ON DELETE SET NULL,
  document_name   text,
  visible_to      text[] NOT NULL DEFAULT ARRAY['lo','borrower','coborrower'],
  financial_content_detected boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cm_thread ON chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_org ON chat_messages(org_id, sender_type);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm_select" ON chat_messages;
CREATE POLICY "cm_select" ON chat_messages FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cm_write" ON chat_messages;
CREATE POLICY "cm_write" ON chat_messages FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- Read receipts (INSERT-only).
CREATE TABLE IF NOT EXISTS chat_read_receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  thread_id   uuid NOT NULL REFERENCES loan_chat_threads(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reader_type text NOT NULL CHECK (reader_type IN ('lo','borrower','coborrower','realtor','title_agent')),
  reader_id   uuid,
  read_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crr_msg ON chat_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_crr_thread ON chat_read_receipts(thread_id, reader_type);
ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crr_select" ON chat_read_receipts;
CREATE POLICY "crr_select" ON chat_read_receipts FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "crr_insert" ON chat_read_receipts;
CREATE POLICY "crr_insert" ON chat_read_receipts FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON chat_read_receipts FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON chat_read_receipts FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON chat_read_receipts FROM service_role;

-- Co-borrower gets a separate portal token (same loan thread, separate auth).
ALTER TABLE borrower_portal_tokens
  ADD COLUMN IF NOT EXISTS participant_type text NOT NULL DEFAULT 'borrower'
  CHECK (participant_type IN ('borrower','coborrower'));

-- ============================================================
-- System messages auto-inserted on milestone stage changes.
-- EXCEPTION-safe: must never break a lead stage update.
-- ============================================================
CREATE OR REPLACE FUNCTION public.chat_system_message_on_stage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_thread uuid;
  v_msg text;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;

  v_msg := CASE NEW.stage
    WHEN 'pre_qual'             THEN 'Pre-approval issued. Congratulations!'
    WHEN 'application'          THEN 'Application submitted.'
    WHEN 'processing'           THEN 'Your file is now in processing.'
    WHEN 'underwriting'         THEN 'Loan file submitted to underwriting.'
    WHEN 'conditional_approval' THEN 'Conditional approval received.'
    WHEN 'clear_to_close'       THEN '🎉 Clear to close! We are scheduling your closing.'
    WHEN 'closed'               THEN '🏠 Loan funded! Congratulations on your new home.'
    ELSE NULL
  END;
  IF v_msg IS NULL THEN RETURN NEW; END IF;

  BEGIN
    SELECT id INTO v_thread FROM loan_chat_threads WHERE lead_id = NEW.id AND org_id = NEW.org_id;
    IF v_thread IS NOT NULL THEN
      INSERT INTO chat_messages (thread_id, org_id, sender_type, content, content_type, visible_to)
      VALUES (v_thread, NEW.org_id, 'system', v_msg, 'system', ARRAY['lo','borrower','coborrower','realtor']);
      -- Archive the thread when the loan closes/funds.
      IF NEW.stage = 'closed' THEN
        UPDATE loan_chat_threads SET archived_at = now() WHERE id = v_thread AND archived_at IS NULL;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block the lead update
  END;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chat_system_message ON leads;
CREATE TRIGGER trg_chat_system_message
  AFTER UPDATE OF stage ON leads
  FOR EACH ROW EXECUTE FUNCTION public.chat_system_message_on_stage();
