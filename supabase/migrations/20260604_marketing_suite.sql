-- ============================================================
-- Conduit CRM — Marketing & Lead Generation Suite
-- Migration: 20260604_marketing_suite.sql
-- ============================================================

-- ── Helper alias (public schema wrapper for auth.get_org_id) ─────────────────
CREATE OR REPLACE FUNCTION public.get_org_id() RETURNS uuid AS $$
  SELECT auth.get_org_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ── Ad Campaigns ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       uuid NOT NULL REFERENCES profiles(id),
  name             text NOT NULL,
  platform         text NOT NULL CHECK (platform IN ('facebook','google','instagram','linkedin','email')),
  goal             text NOT NULL,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','paused','completed')),
  target_config    jsonb NOT NULL DEFAULT '{}',
  creative_config  jsonb NOT NULL DEFAULT '{}',
  daily_budget     numeric(8,2),
  start_date       date,
  end_date         date,
  leads_generated  integer NOT NULL DEFAULT 0,
  spend_to_date    numeric(10,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_org ON ad_campaigns(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(org_id, status);

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_campaigns_org" ON ad_campaigns
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Landing Pages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS landing_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           uuid REFERENCES profiles(id) ON DELETE CASCADE,
  slug            text UNIQUE NOT NULL,
  headline        text NOT NULL,
  subheadline     text,
  features        jsonb NOT NULL DEFAULT '[]',
  lo_config       jsonb NOT NULL DEFAULT '{}',
  active          boolean NOT NULL DEFAULT true,
  page_views      integer NOT NULL DEFAULT 0,
  leads_captured  integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_org ON landing_pages(org_id);
CREATE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);

ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "landing_pages_org" ON landing_pages
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Social Posts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  platform        text NOT NULL CHECK (platform IN ('linkedin','instagram','facebook','twitter')),
  content_type    text NOT NULL,
  tone            text NOT NULL DEFAULT 'professional'
                  CHECK (tone IN ('professional','conversational','educational')),
  body            text NOT NULL,
  hashtags        text[] NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','scheduled','posted')),
  scheduled_at    timestamptz,
  posted_at       timestamptz,
  compliance_flag boolean NOT NULL DEFAULT false,
  compliance_note text,
  engagement_note text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_org ON social_posts(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(org_id, status, scheduled_at);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_posts_org" ON social_posts
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Co-Marketing Materials ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS co_marketing_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  partner_id      uuid REFERENCES referral_partners(id) ON DELETE SET NULL,
  material_type   text NOT NULL CHECK (material_type IN (
                    'rate_sheet','open_house_flyer','just_closed_post',
                    'buyers_guide','email_signature'
                  )),
  content         jsonb NOT NULL DEFAULT '{}',
  preview_html    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_co_mktg_org ON co_marketing_materials(org_id, created_at DESC);

ALTER TABLE co_marketing_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "co_mktg_org" ON co_marketing_materials
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Nurture Sequences ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nurture_sequences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sequence_type   text NOT NULL,
  scheduled_date  timestamptz NOT NULL,
  status          text NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','sent','skipped','bounced')),
  content         text,
  sent_at         timestamptz,
  opened_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nurture_org ON nurture_sequences(org_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_nurture_lead ON nurture_sequences(lead_id, status);
CREATE INDEX IF NOT EXISTS idx_nurture_upcoming ON nurture_sequences(org_id, status, scheduled_date)
  WHERE status = 'scheduled';

ALTER TABLE nurture_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nurture_sequences_org" ON nurture_sequences
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Updated-at triggers ───────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ad_campaigns','social_posts'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ── Comments ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE ad_campaigns IS 'Paid advertising campaign records for Facebook, Google, LinkedIn, Instagram.';
COMMENT ON TABLE landing_pages IS 'LO-specific landing pages with pre-qual form embed and compliance footer.';
COMMENT ON TABLE social_posts IS 'AI-generated social media content library and schedule.';
COMMENT ON TABLE co_marketing_materials IS 'Co-branded materials generated for LO + referral partner pairs.';
COMMENT ON TABLE nurture_sequences IS 'Post-close borrower retention and referral nurture touchpoints.';
