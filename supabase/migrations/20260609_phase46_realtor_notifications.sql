-- ============================================================
-- Ashley IQ — Phase 46: Realtor proactive notifications + planning dates
-- 2026-06-09 — Real schema: loan_files->leads. Adds the missing realtor↔loan
-- link (leads.referral_realtor_id → realtors).
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS referral_realtor_id uuid REFERENCES realtors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_close_date date,
  ADD COLUMN IF NOT EXISTS actual_close_date date,
  ADD COLUMN IF NOT EXISTS pending_signature_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disclosures_signed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_ref_realtor ON leads(referral_realtor_id) WHERE referral_realtor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS realtor_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realtor_id uuid NOT NULL REFERENCES realtors(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('referral_received','application_submitted','loan_approved','clear_to_close','closing_scheduled','loan_funded','stale_check_in')),
  channel text NOT NULL CHECK (channel IN ('sms','email')),
  delivery text NOT NULL DEFAULT 'recorded',
  sent_at timestamptz NOT NULL DEFAULT now(),
  body_preview text,
  UNIQUE(realtor_id, lead_id, notification_type)
);
CREATE INDEX IF NOT EXISTS idx_rn_org ON realtor_notifications(org_id, sent_at DESC);
ALTER TABLE realtor_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rn_select" ON realtor_notifications;
CREATE POLICY "rn_select" ON realtor_notifications FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "rn_insert" ON realtor_notifications;
CREATE POLICY "rn_insert" ON realtor_notifications FOR INSERT WITH CHECK (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON realtor_notifications FROM PUBLIC, authenticated, service_role, anon;
