-- Phase 69 (UI audit fix) — persist saved pricing scenarios. Real schema: organizations/profiles.
CREATE TABLE IF NOT EXISTS pricing_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id), lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  label text, params jsonb NOT NULL, results jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ps_org ON pricing_scenarios(org_id, created_at DESC);
ALTER TABLE pricing_scenarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ps_tenant" ON pricing_scenarios;
CREATE POLICY "ps_tenant" ON pricing_scenarios FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
