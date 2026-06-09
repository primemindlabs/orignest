-- Phase 60 — PrimeMind Sign (GATED) + TRID gate. Real schema: organizations,
-- loans=leads, referral_partners, users=profiles. TRID data lives on leads.
CREATE TABLE IF NOT EXISTS sign_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id uuid REFERENCES leads(id) ON DELETE CASCADE, partner_id uuid REFERENCES referral_partners(id) ON DELETE SET NULL,
  envelope_id text NOT NULL UNIQUE,
  package_type text NOT NULL CHECK (package_type IN ('initial_disclosures','closing_disclosure','loe','rate_lock','co_marketing','rate_lock_extension','other')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','partially_signed','completed','declined','expired','voided')),
  sent_by uuid REFERENCES profiles(id), sent_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz, expires_at timestamptz, voided_at timestamptz, voided_reason text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sign_env_loan ON sign_envelopes(loan_id);
ALTER TABLE sign_envelopes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "se_tenant" ON sign_envelopes;
CREATE POLICY "se_tenant" ON sign_envelopes FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE TABLE IF NOT EXISTS sign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  envelope_id text NOT NULL, event_type text NOT NULL, recipient_role text,
  occurred_at timestamptz NOT NULL DEFAULT now(), metadata jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sign_ev_env ON sign_events(envelope_id, occurred_at DESC);
ALTER TABLE sign_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sev_select" ON sign_events;
CREATE POLICY "sev_select" ON sign_events FOR SELECT USING (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON sign_events FROM PUBLIC, authenticated, service_role, anon;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS earliest_consummation_date date,
  ADD COLUMN IF NOT EXISTS earliest_closing_date date, ADD COLUMN IF NOT EXISTS cd_signed_at timestamptz;
