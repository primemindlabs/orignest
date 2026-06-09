-- Phase 62.1 — LOE Builder. Real schema: loans=leads, users=profiles. No SSN/DOB.
CREATE TABLE IF NOT EXISTS loes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE, lo_id uuid REFERENCES profiles(id),
  category text NOT NULL CHECK (category IN ('large_deposit','credit_inquiry','derogatory_credit','employment_gap','change_of_employment','self_employment_income','address_discrepancy','name_discrepancy','gift_funds','down_payment_source','bankruptcy','foreclosure','deed_in_lieu','short_sale','late_payments','collections','charge_offs','judgments','rental_income','multiple_properties','other')),
  trigger_details jsonb, ai_draft_text text, final_text text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','lo_review','sent_for_signature','signed','submitted_to_uw','accepted')),
  sign_envelope_id text, signed_at timestamptz, submitted_at timestamptz, accepted_at timestamptz,
  created_by uuid REFERENCES profiles(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loes_loan ON loes(loan_id, status);
ALTER TABLE loes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loes_tenant" ON loes;
CREATE POLICY "loes_tenant" ON loes FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
