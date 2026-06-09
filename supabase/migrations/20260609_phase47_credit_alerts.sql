-- ============================================================
-- Ashley IQ — Phase 47: Credit Alert Engine
-- 2026-06-09 — Real schema: tenants->organizations, users->profiles,
-- loan_files->leads. SSN/DOB NEVER stored — match via vendor_borrower_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS credit_monitoring_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enrolled_by uuid REFERENCES profiles(id),
  vendor text NOT NULL CHECK (vendor IN ('creditxpert','factual_data','softpull','scoremaster','credco','xactus','meridianlink','other')),
  vendor_borrower_id text NOT NULL,
  monitoring_type text NOT NULL DEFAULT 'inquiry_alert' CHECK (monitoring_type IN ('inquiry_alert','score_change','score_improvement','full')),
  is_active boolean NOT NULL DEFAULT true,
  enrolled_at timestamptz NOT NULL DEFAULT now(), cancelled_at timestamptz,
  UNIQUE(vendor, vendor_borrower_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_cme_match ON credit_monitoring_enrollments(vendor, vendor_borrower_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_cme_lead ON credit_monitoring_enrollments(lead_id);
ALTER TABLE credit_monitoring_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cme_tenant" ON credit_monitoring_enrollments;
CREATE POLICY "cme_tenant" ON credit_monitoring_enrollments FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS credit_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES credit_monitoring_enrollments(id) ON DELETE SET NULL,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('inquiry','score_increase','score_decrease','derogatory','new_account')),
  vendor text NOT NULL, raw_payload jsonb,
  previous_score integer, new_score integer,
  score_delta integer GENERATED ALWAYS AS (new_score - previous_score) STORED,
  inquiring_lender text,
  lo_notified_at timestamptz, borrower_notified_at timestamptz,
  action_taken text, actioned_at timestamptz, actioned_by uuid REFERENCES profiles(id),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ca_open ON credit_alerts(org_id, received_at DESC) WHERE actioned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ca_lead ON credit_alerts(lead_id, received_at DESC);
ALTER TABLE credit_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ca_select" ON credit_alerts;
CREATE POLICY "ca_select" ON credit_alerts FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ca_insert" ON credit_alerts;
CREATE POLICY "ca_insert" ON credit_alerts FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "ca_update" ON credit_alerts;
CREATE POLICY "ca_update" ON credit_alerts FOR UPDATE USING (org_id = public.get_org_id());
-- Audit trail: updatable for notify/action timestamps, never deleted.
REVOKE DELETE, TRUNCATE ON credit_alerts FROM PUBLIC, authenticated, service_role, anon;
