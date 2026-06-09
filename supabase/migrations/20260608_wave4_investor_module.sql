-- ============================================================
-- AshleyIQ v2 — Wave 4 · Phase 20: Investor module
-- 2026-06-08
-- Entity resolution + portfolio aggregation across an investor's loans.
-- (ATTOM multi-property enrichment via DeedMine is credential-gated.)
-- ============================================================
CREATE TABLE IF NOT EXISTS investor_entities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          text NOT NULL,
  entity_type   text NOT NULL DEFAULT 'individual' CHECK (entity_type IN ('individual','llc','lp','trust','corporation','partnership')),
  contact_email text,
  contact_phone text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_investor_entities_org ON investor_entities(org_id);
ALTER TABLE investor_entities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "investor_entities_select" ON investor_entities;
CREATE POLICY "investor_entities_select" ON investor_entities FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "investor_entities_write" ON investor_entities;
CREATE POLICY "investor_entities_write" ON investor_entities FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS investor_properties (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_id   uuid NOT NULL REFERENCES investor_entities(id) ON DELETE CASCADE,
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_investor_property UNIQUE (org_id, entity_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_investor_properties_org ON investor_properties(org_id);
CREATE INDEX IF NOT EXISTS idx_investor_properties_entity ON investor_properties(entity_id);
ALTER TABLE investor_properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "investor_properties_select" ON investor_properties;
CREATE POLICY "investor_properties_select" ON investor_properties FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "investor_properties_write" ON investor_properties;
CREATE POLICY "investor_properties_write" ON investor_properties FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
