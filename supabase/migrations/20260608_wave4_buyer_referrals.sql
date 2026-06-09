-- ============================================================
-- AshleyIQ v2 — Wave 4 · Phase 19: Buyer referral program
-- 2026-06-08
-- Borrower-driven referrals (distinct from partner referral_attribution).
-- ============================================================
CREATE TABLE IF NOT EXISTS buyer_referrals (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referrer_lead_id   uuid REFERENCES leads(id) ON DELETE SET NULL,
  referral_code      text NOT NULL,
  referred_name      text,
  referred_email     text,
  referred_phone     text,
  status             text NOT NULL DEFAULT 'invited'
                       CHECK (status IN ('invited','contacted','application','closed','declined')),
  converted_lead_id  uuid REFERENCES leads(id) ON DELETE SET NULL,
  reward_amount      numeric(10,2) NOT NULL DEFAULT 0,
  reward_status      text NOT NULL DEFAULT 'pending' CHECK (reward_status IN ('pending','earned','paid','void')),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_buyer_referral_code UNIQUE (org_id, referral_code)
);
CREATE INDEX IF NOT EXISTS idx_buyer_referrals_org_id ON buyer_referrals(org_id);
CREATE INDEX IF NOT EXISTS idx_buyer_referrals_referrer ON buyer_referrals(org_id, referrer_lead_id);
CREATE INDEX IF NOT EXISTS idx_buyer_referrals_status ON buyer_referrals(org_id, status);
ALTER TABLE buyer_referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "buyer_referrals_select" ON buyer_referrals;
CREATE POLICY "buyer_referrals_select" ON buyer_referrals FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "buyer_referrals_write" ON buyer_referrals;
CREATE POLICY "buyer_referrals_write" ON buyer_referrals FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
