-- ============================================================
-- Ashley IQ — Phase 30 · Wave 4: Growth + Enablement
-- 2026-06-09
--
-- 30.7 Rate Drop Campaign Engine, 30.8 Market Update Generator,
-- 30.10 LO Training + Ask Ashley. (30.9 Smart Checklist adds no schema.)
--
-- Translated to real schema: tenant_id -> org_id; get_org_id() RLS;
-- borrower_relationships is the past-borrower source for rate-drop; INSERT-only
-- audit tables (campaign_sends, training_completions) REVOKE upd/del/trunc.
-- ============================================================

-- ============================================================
-- 30.7 — campaign_drafts
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_drafts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_type   text NOT NULL CHECK (campaign_type IN ('rate_drop','anniversary','equity_milestone','seasonal','referral_ask','custom')),
  relationship_id uuid REFERENCES borrower_relationships(id) ON DELETE CASCADE,
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  email_subject   text,
  email_body      text,
  sms_message     text,
  trigger_data    jsonb NOT NULL DEFAULT '{}',
  status          text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','sent','skipped')),
  reviewed_by     uuid REFERENCES profiles(id),
  reviewed_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cd_org_status ON campaign_drafts(org_id, status, created_at DESC);
-- one open draft per relationship per type (avoid dupes on repeated scans)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cd_open_unique ON campaign_drafts(org_id, campaign_type, relationship_id) WHERE status = 'pending_review';
ALTER TABLE campaign_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cd_select" ON campaign_drafts;
CREATE POLICY "cd_select" ON campaign_drafts FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "cd_write" ON campaign_drafts;
CREATE POLICY "cd_write" ON campaign_drafts FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- 30.7 — campaign_sends (INSERT-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_sends (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id    uuid NOT NULL REFERENCES campaign_drafts(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sent_by     uuid REFERENCES profiles(id),
  channel     text NOT NULL CHECK (channel IN ('email','sms','both')),
  relay_message_id text,
  sent_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csend_org ON campaign_sends(org_id, sent_at DESC);
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "csend_select" ON campaign_sends;
CREATE POLICY "csend_select" ON campaign_sends FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "csend_insert" ON campaign_sends;
CREATE POLICY "csend_insert" ON campaign_sends FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON campaign_sends FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON campaign_sends FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON campaign_sends FROM service_role;

-- ============================================================
-- 30.8 — market_updates
-- ============================================================
CREATE TABLE IF NOT EXISTS market_updates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  generated_for   uuid REFERENCES profiles(id),
  rate_30yr_fixed numeric(6,3),
  rate_15yr_fixed numeric(6,3),
  rate_change_bps integer,
  market_context  text,
  linkedin_post   text,
  instagram_caption text,
  sms_blast       text,
  published_channel text,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mu_org ON market_updates(org_id, created_at DESC);
ALTER TABLE market_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mu_select" ON market_updates;
CREATE POLICY "mu_select" ON market_updates FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "mu_write" ON market_updates;
CREATE POLICY "mu_write" ON market_updates FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- 30.10 — training_modules
-- ============================================================
CREATE TABLE IF NOT EXISTS training_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title       text NOT NULL,
  module_type text NOT NULL CHECK (module_type IN ('compliance','program','product','scenario')),
  content     jsonb NOT NULL DEFAULT '{}',
  required_for_roles text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tm_org ON training_modules(org_id);
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tm_select" ON training_modules;
CREATE POLICY "tm_select" ON training_modules FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "tm_write" ON training_modules;
CREATE POLICY "tm_write" ON training_modules FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- 30.10 — training_completions (INSERT-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS training_completions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   uuid NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score       integer NOT NULL,
  passed      boolean NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tc_org ON training_completions(org_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tc_module_user ON training_completions(module_id, user_id);
ALTER TABLE training_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tc_select" ON training_completions;
CREATE POLICY "tc_select" ON training_completions FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "tc_insert" ON training_completions;
CREATE POLICY "tc_insert" ON training_completions FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON training_completions FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON training_completions FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON training_completions FROM service_role;

-- ============================================================
-- 30.7 — daily rate-drop scan (07:00 UTC) -> Vercel cron route (Bearer CRON_SECRET).
-- Same secret requirement as velocity (see Wave 2). No-op until app.cron_secret set.
-- ============================================================
SELECT cron.schedule(
  'rate-drop-scan',
  '0 7 * * *',
  $$SELECT net.http_post(
      url := 'https://ashleyiq.vercel.app/api/cron/rate-drop-scan',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || coalesce(current_setting('app.cron_secret', true), ''),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
  )$$
);
