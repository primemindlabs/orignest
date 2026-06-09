-- ============================================================
-- Ashley IQ — Phase 30 · Wave 3: Document Intelligence
-- 2026-06-09
--
-- 30.2 Competitor LE Analyzer + 30.3 Document Auto-Population.
--
-- AWS Textract is NOT provisioned in this environment (no @aws-sdk dep, no creds,
-- no S3 bucket). So PDF auto-extraction is GATED (the API returns 501 until AWS
-- is configured) — there is no faked extraction. The Claude comparison/talking-
-- points (30.2) and Claude field interpretation (30.3) are real and run on text
-- once it exists; 30.2 also works fully today via manual fee entry.
--
-- Schema translated to real columns: tenant_id -> org_id; get_org_id() RLS.
-- There is no loan_estimates table, so "our LE" figures are stored inline as a
-- jsonb snapshot rather than via a FK. document_extractions.document_id -> the
-- real documents table.
--
-- SECURITY: only ssn_last4 / account_last4 are ever stored — never full values.
-- ============================================================

-- ============================================================
-- 30.2 — competitor_le_uploads
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_le_uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by     uuid REFERENCES profiles(id),
  storage_path    text,                   -- private bucket; null when entered manually
  source          text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','pdf_extract')),
  competitor_name text,
  competitor_fees jsonb NOT NULL DEFAULT '{}',
  competitor_rate numeric(6,3),
  competitor_apr  numeric(6,3),
  competitor_points numeric(5,3),
  competitor_total_closing_costs numeric(12,2),
  -- "our LE" figures used in the comparison (no loan_estimates table to FK)
  our_le_snapshot jsonb NOT NULL DEFAULT '{}',
  analysis        jsonb,                  -- { talking_points[], summary, net_difference_5yr, we_win_on[] }
  created_at      timestamptz NOT NULL DEFAULT now(),
  purge_after     timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS idx_cle_lead ON competitor_le_uploads(lead_id, created_at DESC);
ALTER TABLE competitor_le_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cle_select" ON competitor_le_uploads;
CREATE POLICY "cle_select" ON competitor_le_uploads FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cle_write" ON competitor_le_uploads;
CREATE POLICY "cle_write" ON competitor_le_uploads FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- 30.3 — document_extractions
-- ============================================================
CREATE TABLE IF NOT EXISTS document_extractions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id     uuid REFERENCES documents(id) ON DELETE SET NULL,
  document_type   text NOT NULL CHECK (document_type IN ('paystub','w2','bank_statement','1099','tax_return','unknown')),
  extracted_fields jsonb NOT NULL DEFAULT '{}',
  confidence      numeric(3,2) NOT NULL DEFAULT 0,
  discrepancies   jsonb NOT NULL DEFAULT '[]',
  lo_confirmed    boolean NOT NULL DEFAULT false,
  lo_confirmed_at timestamptz,
  confirmed_by    uuid REFERENCES profiles(id),
  fields_applied  jsonb NOT NULL DEFAULT '[]',
  model_version   text NOT NULL DEFAULT 'claude-sonnet-4-5',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_de_lead ON document_extractions(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_de_unconfirmed ON document_extractions(org_id, lo_confirmed) WHERE lo_confirmed = false;
ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "de_select" ON document_extractions;
CREATE POLICY "de_select" ON document_extractions FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "de_write" ON document_extractions;
CREATE POLICY "de_write" ON document_extractions FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
