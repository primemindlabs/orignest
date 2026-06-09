-- Phase 61.2 — Text-to-Apply. SMS flow Twilio-GATED; state machine + scoring pure/live.
-- Real schema: organizations/profiles/leads.
CREATE TABLE IF NOT EXISTS text_to_apply_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id uuid REFERENCES profiles(id), twilio_number text NOT NULL, keyword text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  welcome_message text NOT NULL DEFAULT 'Hi! Reply YES to receive mortgage info from your loan officer. Std msg rates apply. Reply STOP to opt out.',
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(twilio_number, keyword)
);
ALTER TABLE text_to_apply_keywords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ttak_tenant" ON text_to_apply_keywords;
CREATE POLICY "ttak_tenant" ON text_to_apply_keywords FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE TABLE IF NOT EXISTS tta_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id uuid REFERENCES profiles(id), keyword_id uuid REFERENCES text_to_apply_keywords(id) ON DELETE SET NULL,
  phone_number text NOT NULL, current_state text NOT NULL DEFAULT 'awaiting_consent',
  responses jsonb NOT NULL DEFAULT '{}', consent_given boolean NOT NULL DEFAULT false, consent_at timestamptz,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(), last_activity timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz, abandoned_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_tta_phone ON tta_sessions(phone_number, current_state);
ALTER TABLE tta_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tta_tenant" ON tta_sessions;
CREATE POLICY "tta_tenant" ON tta_sessions FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
