-- ============================================================
-- Orignest — Lenders, Revenue Intelligence, Commissions
-- 2026-06-04
-- ============================================================

-- ============================================================
-- LENDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS lenders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  channel             text NOT NULL CHECK (channel IN ('wholesale','correspondent','direct','hard_money','private')),
  website             text,
  ae_name             text,
  ae_phone            text,
  ae_email            text,
  products            text[] NOT NULL DEFAULT '{}',
  licensed_states     text[] NOT NULL DEFAULT '{}',
  min_fico            integer,
  max_ltv             numeric(5,2),
  specialty_tags      text[] NOT NULL DEFAULT '{}',
  avg_turnaround_days integer,
  is_preferred        boolean NOT NULL DEFAULT false,
  notes               text,
  loans_submitted     integer NOT NULL DEFAULT 0,
  loans_closed        integer NOT NULL DEFAULT 0,
  avg_days_to_close   integer,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lenders_org_id ON lenders(org_id);
CREATE INDEX IF NOT EXISTS idx_lenders_org_preferred ON lenders(org_id, is_preferred DESC);

ALTER TABLE lenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lenders_org" ON lenders FOR ALL
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
-- LENDER PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lender_products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id        uuid NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_type        text NOT NULL,
  min_fico         integer,
  max_ltv          numeric(5,2),
  max_dti          numeric(5,2),
  max_loan_amount  numeric(14,2),
  allowed_states   text[] DEFAULT '{}',
  overlay_notes    text,
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lender_products_lender_id ON lender_products(lender_id);
CREATE INDEX IF NOT EXISTS idx_lender_products_org_id ON lender_products(org_id);

ALTER TABLE lender_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lender_products_org" ON lender_products FOR ALL
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
-- LENDER COMM LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS lender_comm_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id   uuid NOT NULL REFERENCES lenders(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lender_comm_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lender_comm_log_org" ON lender_comm_log FOR ALL
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
-- COMMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS commissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lo_id                 uuid NOT NULL REFERENCES profiles(id),
  loan_amount           numeric(14,2) NOT NULL,
  close_date            date NOT NULL,
  loan_type             text NOT NULL,
  compensation_type     text NOT NULL CHECK (compensation_type IN ('lender_paid','borrower_paid')),
  compensation_bps      numeric(6,2),
  compensation_amount   numeric(12,2) NOT NULL,
  referral_fee_amount   numeric(12,2) NOT NULL DEFAULT 0,
  net_revenue           numeric(12,2),
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','paid','clawed_back')),
  payment_date          date,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_org_id ON commissions(org_id);
CREATE INDEX IF NOT EXISTS idx_commissions_lo_id ON commissions(lo_id);
CREATE INDEX IF NOT EXISTS idx_commissions_close_date ON commissions(org_id, close_date DESC);

ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions_org" ON commissions FOR ALL
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
-- LO PERFORMANCE SNAPSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS lo_performance_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_month    date NOT NULL, -- first day of the month
  loans_originated integer NOT NULL DEFAULT 0,
  total_volume    numeric(16,2) NOT NULL DEFAULT 0,
  total_revenue   numeric(12,2) NOT NULL DEFAULT 0,
  avg_loan_size   numeric(14,2),
  pull_through_rate numeric(5,2),
  avg_days_to_close integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lo_performance_unique ON lo_performance_snapshots(org_id, lo_id, period_month);

ALTER TABLE lo_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lo_performance_org" ON lo_performance_snapshots FOR ALL
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
