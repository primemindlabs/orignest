-- ============================================================
-- Ashley IQ — Phase 52: EMD + MERS + first-payment + lock desk
-- 2026-06-09 — Real schema: users->profiles, loans=leads.
-- ============================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS emd_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS emd_due_date date,
  ADD COLUMN IF NOT EXISTS emd_received_date date,
  ADD COLUMN IF NOT EXISTS emd_received_confirmed_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS emd_notes text,
  ADD COLUMN IF NOT EXISTS emd_held_by text,
  ADD COLUMN IF NOT EXISTS emd_held_by_name text,
  ADD COLUMN IF NOT EXISTS mers_min text,
  ADD COLUMN IF NOT EXISTS mers_registered_date date,
  ADD COLUMN IF NOT EXISTS mers_transfer_date date,
  ADD COLUMN IF NOT EXISTS mers_deactivated_date date,
  ADD COLUMN IF NOT EXISTS mers_status text CHECK (mers_status IN ('pending','registered','transferred','deactivated')),
  ADD COLUMN IF NOT EXISTS first_payment_date date,
  ADD COLUMN IF NOT EXISTS loan_servicer_name text,
  ADD COLUMN IF NOT EXISTS loan_servicer_payment_url text,
  ADD COLUMN IF NOT EXISTS monthly_payment_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS first_payment_reminder_sent boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS rate_lock_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES profiles(id),
  request_type text NOT NULL CHECK (request_type IN ('new_lock','extension','renegotiation','float_to_lock','lock_cancellation')),
  requested_rate numeric(6,4), requested_lock_days integer, requested_price numeric(6,4), requested_lock_expiration date,
  original_lock_expiration date, extension_days integer, extension_cost_bps numeric(6,2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  reviewed_by uuid REFERENCES profiles(id), reviewed_at timestamptz, review_notes text,
  is_float_down_eligible boolean DEFAULT false, float_down_threshold numeric(6,4),
  notes text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rlr_lead ON rate_lock_requests(lead_id, created_at DESC);
ALTER TABLE rate_lock_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rlr_select" ON rate_lock_requests;
CREATE POLICY "rlr_select" ON rate_lock_requests FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "rlr_insert" ON rate_lock_requests;
CREATE POLICY "rlr_insert" ON rate_lock_requests FOR INSERT WITH CHECK (org_id = public.get_org_id());
DROP POLICY IF EXISTS "rlr_update" ON rate_lock_requests;
CREATE POLICY "rlr_update" ON rate_lock_requests FOR UPDATE USING (org_id = public.get_org_id());
REVOKE DELETE, TRUNCATE ON rate_lock_requests FROM PUBLIC, authenticated, service_role, anon;
