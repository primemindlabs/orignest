-- ============================================================
-- Ashley IQ — Phase 49: AMC Integration (Mercury Network + generic)
-- 2026-06-09 — Real schema: tenants->organizations, users->profiles,
-- loan_files->leads. vendor_orders absent (Phase 45 deferred) — no link.
-- Credentials AES-256-GCM encrypted (lib/crypto/encrypt, same as LOS).
-- ============================================================

CREATE TABLE IF NOT EXISTS amc_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor text NOT NULL, display_name text NOT NULL, credentials text NOT NULL,
  is_active boolean NOT NULL DEFAULT true, last_verified_at timestamptz, sync_error text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, vendor)
);
ALTER TABLE amc_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "amc_conn_tenant" ON amc_connections;
CREATE POLICY "amc_conn_tenant" ON amc_connections FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS appraisal_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amc_connection_id uuid REFERENCES amc_connections(id) ON DELETE SET NULL,
  amc_order_id text, amc_vendor text NOT NULL,
  property_address text, appraisal_type text NOT NULL DEFAULT 'full_1004',
  rush_order boolean NOT NULL DEFAULT false,
  fee_amount numeric(8,2), fee_paid_by text DEFAULT 'borrower' CHECK (fee_paid_by IN ('borrower','lender','broker')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ordered','assigned','inspection_scheduled','inspection_complete','report_in_review','report_delivered','revision_requested','completed','cancelled')),
  appraiser_name text, appraiser_license text, appraiser_company text,
  inspection_scheduled_at timestamptz, inspection_completed_at timestamptz, report_delivered_at timestamptz,
  appraised_value numeric(12,2), report_document_id uuid,
  amc_status_history jsonb NOT NULL DEFAULT '[]',
  ordered_by uuid REFERENCES profiles(id),
  ordered_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ao_lead ON appraisal_orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_ao_open ON appraisal_orders(org_id, status) WHERE status <> 'completed';
CREATE INDEX IF NOT EXISTS idx_ao_amc_order ON appraisal_orders(amc_order_id);
ALTER TABLE appraisal_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ao_tenant" ON appraisal_orders;
CREATE POLICY "ao_tenant" ON appraisal_orders FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
