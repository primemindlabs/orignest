-- Phase 4.2 — two-way borrower ↔ LO messaging
BEGIN;
CREATE TABLE IF NOT EXISTS portal_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id          uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sender_type      text NOT NULL CHECK (sender_type IN ('borrower','lo','system')),
  sender_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  message          text NOT NULL,
  read_by_borrower boolean NOT NULL DEFAULT false,
  read_by_lo       boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE portal_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pm_select" ON portal_messages;
CREATE POLICY "pm_select" ON portal_messages FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "pm_insert" ON portal_messages;
CREATE POLICY "pm_insert" ON portal_messages FOR INSERT WITH CHECK (org_id = public.get_org_id());
CREATE INDEX IF NOT EXISTS idx_portal_messages_lead ON portal_messages(lead_id, created_at);
COMMIT;
