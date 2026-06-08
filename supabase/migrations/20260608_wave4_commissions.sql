-- ============================================================
-- AshleyIQ v2 — Wave 4 · Phase 6: Commissions Engine
-- 2026-06-08
--
-- Builds the comp engine ON TOP of the existing `commissions` table
-- (defined in 20260604_lenders_revenue.sql):
--   • comp_plans         — LO compensation plans (Reg Z 1026.36 compliant)
--   • commission_splits  — split a closed commission across participants
--   • manager_overrides  — manager override comp on a team member's loan
--   • clawback_events    — INSERT-ONLY audit log of commission clawbacks
--
-- COMPLIANCE — Reg Z 1026.36(d)(1): loan-originator compensation may NOT be
-- based on the terms of the transaction (rate, points, product, etc.). It MAY
-- be based on the loan AMOUNT (a fixed % / bps) or a flat per-loan figure.
-- This schema enforces that at the data layer: comp is derived solely from
-- loan amount — there is no column that lets comp vary by rate/term/product,
-- and a CHECK constraint pins each plan to a loan-amount-only basis.
-- ============================================================

-- ============================================================
-- COMP PLANS — Reg Z: loan-amount-only basis
-- ============================================================
CREATE TABLE IF NOT EXISTS comp_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL lo_id = org-wide default plan; set = plan assigned to one LO.
  lo_id             uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name              text NOT NULL,
  -- The ONLY two permissible comp bases under Reg Z 1026.36(d)(1):
  --   'bps'  → compensation_bps basis points of the loan amount
  --   'flat' → fixed dollars per closed loan (independent of terms)
  basis             text NOT NULL CHECK (basis IN ('bps','flat')),
  comp_bps          numeric(6,2),   -- basis points of loan amount (basis='bps')
  comp_flat         numeric(12,2),  -- flat $ per loan            (basis='flat')
  -- Optional loan-AMOUNT band so a plan can act as one tier of an
  -- amount-based tier ladder (permitted: tiering by amount, NOT by terms).
  min_loan_amount   numeric(14,2) NOT NULL DEFAULT 0,
  max_loan_amount   numeric(14,2),  -- NULL = no upper bound
  -- Optional per-loan dollar cap on computed comp.
  max_comp_amount   numeric(12,2),
  effective_date    date NOT NULL DEFAULT CURRENT_DATE,
  is_active         boolean NOT NULL DEFAULT true,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Reg Z 1026.36(d)(1): comp is keyed on loan amount only. The correct field
  -- must be populated for the chosen basis (and the other left null), so comp
  -- can never be driven by anything but the amount.
  CONSTRAINT chk_regz_loan_amount_only CHECK (
    (basis = 'bps'  AND comp_bps  IS NOT NULL AND comp_bps  >= 0 AND comp_flat IS NULL) OR
    (basis = 'flat' AND comp_flat IS NOT NULL AND comp_flat >= 0 AND comp_bps  IS NULL)
  ),
  CONSTRAINT chk_comp_amount_band CHECK (
    max_loan_amount IS NULL OR max_loan_amount >= min_loan_amount
  )
);

CREATE INDEX IF NOT EXISTS idx_comp_plans_org_id ON comp_plans(org_id);
CREATE INDEX IF NOT EXISTS idx_comp_plans_lo ON comp_plans(org_id, lo_id, is_active);

ALTER TABLE comp_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comp_plans_select" ON comp_plans;
CREATE POLICY "comp_plans_select" ON comp_plans
  FOR SELECT USING (org_id = public.get_org_id());

DROP POLICY IF EXISTS "comp_plans_write" ON comp_plans;
CREATE POLICY "comp_plans_write" ON comp_plans
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- Link a closed commission to the plan used to compute it.
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS comp_plan_id uuid REFERENCES comp_plans(id);

-- ============================================================
-- COMMISSION SPLITS — divide a closed commission across people
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_splits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commission_id   uuid NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'co_originator'
                    CHECK (role IN ('originator','co_originator','team_lead','assistant')),
  split_pct       numeric(5,2) NOT NULL CHECK (split_pct >= 0 AND split_pct <= 100),
  split_amount    numeric(12,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_splits_org_id ON commission_splits(org_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_commission ON commission_splits(commission_id);
CREATE INDEX IF NOT EXISTS idx_commission_splits_profile ON commission_splits(org_id, profile_id);

ALTER TABLE commission_splits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_splits_select" ON commission_splits;
CREATE POLICY "commission_splits_select" ON commission_splits
  FOR SELECT USING (org_id = public.get_org_id());

DROP POLICY IF EXISTS "commission_splits_write" ON commission_splits;
CREATE POLICY "commission_splits_write" ON commission_splits
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- MANAGER OVERRIDES — override comp earned by a manager on a
-- team member's closed loan (also loan-amount-keyed: bps or flat)
-- ============================================================
CREATE TABLE IF NOT EXISTS manager_overrides (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commission_id       uuid NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  manager_profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  override_bps        numeric(6,2),    -- basis points of loan amount
  override_flat       numeric(12,2),   -- or flat $ per loan
  override_amount     numeric(12,2) NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Reg Z: overrides are also keyed on loan amount only — exactly one basis.
  CONSTRAINT chk_override_loan_amount_only CHECK (
    (override_bps  IS NOT NULL AND override_flat IS NULL  AND override_bps  >= 0) OR
    (override_flat IS NOT NULL AND override_bps  IS NULL  AND override_flat >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_manager_overrides_org_id ON manager_overrides(org_id);
CREATE INDEX IF NOT EXISTS idx_manager_overrides_commission ON manager_overrides(commission_id);
CREATE INDEX IF NOT EXISTS idx_manager_overrides_manager ON manager_overrides(org_id, manager_profile_id);

ALTER TABLE manager_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_overrides_select" ON manager_overrides;
CREATE POLICY "manager_overrides_select" ON manager_overrides
  FOR SELECT USING (org_id = public.get_org_id());

DROP POLICY IF EXISTS "manager_overrides_write" ON manager_overrides;
CREATE POLICY "manager_overrides_write" ON manager_overrides
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- CLAWBACK EVENTS — INSERT-ONLY AUDIT LOG (append-only)
-- Per the non-negotiable audit rule: no UPDATE/DELETE for ANY
-- role, including service_role.
-- ============================================================
CREATE TABLE IF NOT EXISTS clawback_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  commission_id   uuid NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  lo_id           uuid NOT NULL REFERENCES profiles(id),
  clawback_amount numeric(12,2) NOT NULL,
  reason          text NOT NULL,
  -- Clerk user id of whoever recorded the clawback (audit trail).
  created_by      text,
  event_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clawback_events_org_id ON clawback_events(org_id);
CREATE INDEX IF NOT EXISTS idx_clawback_events_commission ON clawback_events(commission_id);
CREATE INDEX IF NOT EXISTS idx_clawback_events_lo ON clawback_events(org_id, lo_id);

ALTER TABLE clawback_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clawback_events_select" ON clawback_events;
CREATE POLICY "clawback_events_select" ON clawback_events
  FOR SELECT USING (org_id = public.get_org_id());

-- Append-only: inserts allowed (org-scoped or via service role); no edits ever.
DROP POLICY IF EXISTS "clawback_events_insert" ON clawback_events;
CREATE POLICY "clawback_events_insert" ON clawback_events
  FOR INSERT WITH CHECK (TRUE);

REVOKE UPDATE ON clawback_events FROM PUBLIC;
REVOKE DELETE ON clawback_events FROM PUBLIC;
REVOKE UPDATE ON clawback_events FROM service_role;
REVOKE DELETE ON clawback_events FROM service_role;
REVOKE UPDATE ON clawback_events FROM authenticated;
REVOKE DELETE ON clawback_events FROM authenticated;
