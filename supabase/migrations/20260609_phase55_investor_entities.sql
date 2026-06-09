-- Phase 55.2 — investor entity resolution. Extends existing minimal investor_entities.
-- EIN AES-256-GCM (lib/crypto/encrypt). Real schema: users->profiles, loans=leads.
ALTER TABLE investor_entities
  ADD COLUMN IF NOT EXISTS ein_encrypted text, ADD COLUMN IF NOT EXISTS ein_last4 text,
  ADD COLUMN IF NOT EXISTS state_of_formation text, ADD COLUMN IF NOT EXISTS formation_date date,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false, ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE TABLE IF NOT EXISTS borrower_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES investor_entities(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('owner','member','trustee','guarantor','manager','partner')),
  ownership_percentage numeric(5,2) CHECK (ownership_percentage BETWEEN 0 AND 100),
  is_primary_signer boolean DEFAULT false, confirmed_by_borrower boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(lead_id, entity_id, relationship)
);
CREATE INDEX IF NOT EXISTS idx_bel_lead ON borrower_entity_links(lead_id);
ALTER TABLE borrower_entity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bel_tenant" ON borrower_entity_links;
CREATE POLICY "bel_tenant" ON borrower_entity_links FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS loan_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES investor_entities(id) ON DELETE CASCADE,
  vesting_type text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(lead_id, entity_id)
);
ALTER TABLE loan_entity_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lel_tenant" ON loan_entity_links;
CREATE POLICY "lel_tenant" ON loan_entity_links FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
