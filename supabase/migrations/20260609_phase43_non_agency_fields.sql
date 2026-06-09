-- ============================================================
-- Ashley IQ — Phase 43: DSCR / Non-QM / Commercial
-- 2026-06-09 — Real schema: loans are `leads` (no loan_files table); loan_type is
-- TEXT (no enum to alter — non-agency/commercial values work as text). leads.stage
-- CHECK stays as-is (residential stages); loan_category is classification only.
-- ============================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS loan_file_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS commercial_property_type text,
  ADD COLUMN IF NOT EXISTS noi_annual numeric(15,2),
  ADD COLUMN IF NOT EXISTS cap_rate numeric(6,4),
  ADD COLUMN IF NOT EXISTS occupancy_rate numeric(6,4),
  ADD COLUMN IF NOT EXISTS num_units integer,
  ADD COLUMN IF NOT EXISTS square_footage integer,
  ADD COLUMN IF NOT EXISTS is_bridge_loan boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bridge_exit_strategy text,
  ADD COLUMN IF NOT EXISTS guarantor_type text,
  ADD COLUMN IF NOT EXISTS environmental_phase text,
  ADD COLUMN IF NOT EXISTS is_sba_eligible boolean,
  ADD COLUMN IF NOT EXISTS sba_program text;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS loan_category text
  GENERATED ALWAYS AS (
    CASE
      WHEN loan_type IN ('conventional','fha','va','usda','jumbo') THEN 'residential'
      WHEN loan_type LIKE 'dscr%' OR loan_type LIKE 'non_qm%' THEN 'non_agency'
      WHEN loan_type LIKE 'commercial%' THEN 'commercial'
      ELSE 'residential'
    END
  ) STORED;
CREATE INDEX IF NOT EXISTS idx_leads_loan_category ON leads(org_id, loan_category);
