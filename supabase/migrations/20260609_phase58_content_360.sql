-- Phase 58.3 — Content 360 per-contact engagement. content_engagements INSERT-only
-- audit (UPD/DEL/TRUNC revoked). content_360_recommendations cache. org_id RLS. No SSN/DOB.
CREATE TABLE IF NOT EXISTS content_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_type text NOT NULL CHECK (contact_type IN ('lead','realtor','partner')), contact_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('email_campaign','email_manual','sms','social_post','video_message','co_marketing_flyer','market_update','rate_drop_alert','pre_approval_letter','scenario_pdf','loan_estimate','closing_disclosure','content_calendar_post')),
  content_id uuid, content_title text,
  event_type text NOT NULL CHECK (event_type IN ('sent','delivered','opened','clicked','replied','downloaded','watched','shared','bounced','unsubscribed')),
  event_metadata jsonb, occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_eng_contact ON content_engagements(contact_id, contact_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_eng_org ON content_engagements(org_id, occurred_at DESC);
ALTER TABLE content_engagements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ce_select" ON content_engagements;
CREATE POLICY "ce_select" ON content_engagements FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ce_insert" ON content_engagements;
CREATE POLICY "ce_insert" ON content_engagements FOR INSERT WITH CHECK (org_id = public.get_org_id());
REVOKE UPDATE, DELETE, TRUNCATE ON content_engagements FROM PUBLIC, authenticated, service_role, anon;

CREATE TABLE IF NOT EXISTS content_360_recommendations (
  contact_id uuid NOT NULL, contact_type text NOT NULL, org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recommendations jsonb NOT NULL, generated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (contact_id, contact_type)
);
ALTER TABLE content_360_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "c360_all" ON content_360_recommendations;
CREATE POLICY "c360_all" ON content_360_recommendations FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
