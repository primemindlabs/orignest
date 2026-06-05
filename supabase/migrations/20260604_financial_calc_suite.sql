-- ============================================================
-- Orignest — Financial Calculation Suite
-- 2026-06-04
-- ============================================================

-- ============================================================
-- PRICING SCENARIOS
-- ============================================================
CREATE TABLE IF NOT EXISTS pricing_scenarios (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  name                  TEXT NOT NULL DEFAULT 'Untitled Scenario',
  inputs                JSONB NOT NULL,
  results               JSONB NOT NULL,
  shared_with_borrower  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_scenarios_org_id ON pricing_scenarios(org_id, created_at DESC);
CREATE INDEX idx_pricing_scenarios_lead_id ON pricing_scenarios(lead_id);

ALTER TABLE pricing_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_scenarios_org"
  ON pricing_scenarios FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- ============================================================
-- COMMERCIAL DEALS
-- ============================================================
CREATE TABLE IF NOT EXISTS commercial_deals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_by            UUID NOT NULL REFERENCES profiles(id),
  deal_type             TEXT NOT NULL CHECK (
                          deal_type IN (
                            'multifamily', 'commercial', 'mixed_use',
                            'sba', 'bridge', 'construction'
                          )
                        ),
  property_address      TEXT,
  purchase_price        NUMERIC(14, 2),
  loan_amount           NUMERIC(14, 2),
  noi                   NUMERIC(14, 2),
  cap_rate              NUMERIC(5, 3),
  dscr                  NUMERIC(5, 3),
  bridge_maturity_date  DATE,
  exit_strategy         TEXT,
  status                TEXT NOT NULL DEFAULT 'analyzing'
                          CHECK (
                            status IN (
                              'analyzing', 'submitted', 'approved',
                              'closed', 'declined'
                            )
                          ),
  analysis_data         JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commercial_deals_org_id ON commercial_deals(org_id, created_at DESC);
CREATE INDEX idx_commercial_deals_lead_id ON commercial_deals(lead_id);
CREATE INDEX idx_commercial_deals_status ON commercial_deals(org_id, status);
CREATE INDEX idx_commercial_deals_bridge_maturity ON commercial_deals(bridge_maturity_date)
  WHERE bridge_maturity_date IS NOT NULL;

ALTER TABLE commercial_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_deals_org"
  ON commercial_deals FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_commercial_deals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_commercial_deals_updated_at
  BEFORE UPDATE ON commercial_deals
  FOR EACH ROW
  EXECUTE FUNCTION update_commercial_deals_updated_at();

-- ============================================================
-- NON-QM ANALYSES (saved DSCR / bank statement / asset depletion / P&L)
-- ============================================================
CREATE TABLE IF NOT EXISTS nonqm_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  analysis_type   TEXT NOT NULL CHECK (
                    analysis_type IN (
                      'dscr', 'bank_statement', 'asset_depletion',
                      'pl_1099', 'fix_flip'
                    )
                  ),
  name            TEXT NOT NULL DEFAULT 'Untitled Analysis',
  inputs          JSONB NOT NULL,
  results         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_nonqm_analyses_org_id ON nonqm_analyses(org_id, created_at DESC);
CREATE INDEX idx_nonqm_analyses_lead_id ON nonqm_analyses(lead_id);

ALTER TABLE nonqm_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nonqm_analyses_org"
  ON nonqm_analyses FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations
      WHERE clerk_org_id = (
        SELECT current_setting('request.jwt.claims', true)::json->>'org_id'
      )
    )
  );
