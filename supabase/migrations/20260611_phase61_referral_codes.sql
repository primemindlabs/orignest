-- Phase 61.1 — per-LO shareable referral codes + INSERT-only event audit. Reuses
-- existing buyer_referrals for referral records. Real schema: organizations/profiles/leads.
CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id uuid REFERENCES profiles(id), source_loan_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE, is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rc_org_code ON referral_codes(org_id, code);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rc_tenant" ON referral_codes;
CREATE POLICY "rc_tenant" ON referral_codes FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
CREATE TABLE IF NOT EXISTS referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  referral_code text NOT NULL, source_loan_id uuid REFERENCES leads(id) ON DELETE SET NULL, referred_lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  referrer_name text, referred_name text, referred_email text, referred_phone text,
  event_type text NOT NULL CHECK (event_type IN ('link_clicked','form_submitted','lead_created','application_started','application_completed','loan_closed','reward_issued','reward_redeemed')),
  reward_type text, reward_amount numeric(10,2), notes text, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_re_code ON referral_events(referral_code, occurred_at DESC);
ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "re_select" ON referral_events;
CREATE POLICY "re_select" ON referral_events FOR SELECT USING (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON referral_events FROM PUBLIC, authenticated, service_role, anon;
