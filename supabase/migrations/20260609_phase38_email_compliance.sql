-- ============================================================
-- Ashley IQ — Phase 38: Email/SMS compliance
-- 2026-06-09 — Real schema: tenants -> organizations.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  email text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  unsubscribed_at timestamptz NOT NULL DEFAULT now(),
  source text,                 -- one_click | sms_stop | spam_complaint | manual
  UNIQUE(org_id, email)
);
CREATE INDEX IF NOT EXISTS idx_unsub_email ON email_unsubscribes(lower(email));
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unsub_select" ON email_unsubscribes;
CREATE POLICY "unsub_select" ON email_unsubscribes FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "unsub_insert" ON email_unsubscribes;
CREATE POLICY "unsub_insert" ON email_unsubscribes FOR INSERT WITH CHECK (TRUE);
-- INSERT-only — never updated or deleted, not even by service_role.
REVOKE UPDATE, DELETE, TRUNCATE ON email_unsubscribes FROM PUBLIC, authenticated, service_role, anon;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS email_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_bounced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_opt_out boolean NOT NULL DEFAULT false;
