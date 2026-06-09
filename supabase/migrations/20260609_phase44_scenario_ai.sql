-- ============================================================
-- Ashley IQ — Phase 44: Scenario AI — Lender Match Engine
-- 2026-06-09 — Real schema: tenants->organizations, users->profiles,
-- loan_files->leads. Scenario AI reads the EXISTING `lenders` matrix
-- (managed at /lenders) — preferred_lenders is created per spec but the
-- live analyzer uses `lenders`. scenario_runs logs every AI run (INSERT-only).
-- ============================================================

CREATE TABLE IF NOT EXISTS preferred_lenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  lender_name text NOT NULL,
  lender_type text NOT NULL CHECK (lender_type IN ('wholesale','correspondent','portfolio','hard_money','bank')),
  ae_name text, ae_email text, ae_phone text,
  loan_types text[] NOT NULL DEFAULT '{}',
  min_fico integer, max_ltv numeric(5,4), min_loan_amt integer, max_loan_amt integer,
  notes text, overlay_notes jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pl_org ON preferred_lenders(org_id) WHERE is_active;
ALTER TABLE preferred_lenders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pl_tenant" ON preferred_lenders;
CREATE POLICY "pl_tenant" ON preferred_lenders FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS scenario_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_by uuid REFERENCES profiles(id),
  scenario_inputs jsonb NOT NULL DEFAULT '{}',
  scenario_type text NOT NULL DEFAULT 'full_analysis',
  quick_pick_key text,
  result jsonb NOT NULL DEFAULT '{}',
  lenders_matched uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sr_lead ON scenario_runs(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sr_org ON scenario_runs(org_id, created_at DESC);
ALTER TABLE scenario_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_select" ON scenario_runs;
CREATE POLICY "sr_select" ON scenario_runs FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "sr_insert" ON scenario_runs;
CREATE POLICY "sr_insert" ON scenario_runs FOR INSERT WITH CHECK (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON scenario_runs FROM PUBLIC, authenticated, service_role, anon;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS lender_matrix_prompt text;
