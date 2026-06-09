-- Phase 61.1 (deferred completion) — referral reward tracking. RESPA Sec 8: rewards
-- created only after the referred loan closes, de-minimis, not tied to settlement-service.
CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  referral_event_id uuid REFERENCES referral_events(id) ON DELETE SET NULL,
  source_loan_id uuid REFERENCES leads(id) ON DELETE SET NULL, referred_loan_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  lo_id uuid REFERENCES profiles(id), reward_type text NOT NULL, reward_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','issued','redeemed','cancelled')),
  approved_by uuid REFERENCES profiles(id), approved_at timestamptz, issued_at timestamptz, notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rr_org ON referral_rewards(org_id, status);
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rr_tenant" ON referral_rewards;
CREATE POLICY "rr_tenant" ON referral_rewards FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
