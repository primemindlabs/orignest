-- ============================================================
-- Conduit CRM — Communication Hub
-- Migration: 20260605_communication_hub.sql
-- Features: Unified Inbox, Video Messages, Doc Templates,
--           NPS Responses, Email Integrations
-- ============================================================

-- ── Inbound Messages (unified inbox) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inbound_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id       uuid REFERENCES leads(id) ON DELETE SET NULL,
  channel       text NOT NULL CHECK (channel IN ('sms','email','instagram','facebook','voicemail')),
  from_address  text NOT NULL, -- phone number or email address
  to_address    text NOT NULL,
  body          text NOT NULL,
  raw_payload   jsonb,
  read_at       timestamptz,
  replied_at    timestamptz,
  lo_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbound_messages_org      ON inbound_messages(org_id, created_at DESC);
CREATE INDEX idx_inbound_messages_lead     ON inbound_messages(lead_id, created_at DESC);
CREATE INDEX idx_inbound_messages_unread   ON inbound_messages(org_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_inbound_messages_channel  ON inbound_messages(org_id, channel, created_at DESC);

ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbound_messages_org" ON inbound_messages FOR ALL
  USING (org_id = auth.get_org_id()) WITH CHECK (org_id = auth.get_org_id());

-- ── Video Messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id            uuid NOT NULL REFERENCES profiles(id),
  lead_id          uuid REFERENCES leads(id) ON DELETE SET NULL,
  storage_path     text NOT NULL,
  public_url       text NOT NULL,
  thumbnail_url    text,
  duration_seconds integer,
  title            text,
  view_count       integer NOT NULL DEFAULT 0,
  first_viewed_at  timestamptz,
  last_viewed_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE video_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_messages_org" ON video_messages FOR ALL
  USING (org_id = auth.get_org_id()) WITH CHECK (org_id = auth.get_org_id());
-- Public select for shareable links (no auth required to view a video)
CREATE POLICY "video_messages_public_select" ON video_messages FOR SELECT USING (TRUE);

-- ── Document Templates ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = system template
  category      text NOT NULL,
  name          text NOT NULL,
  description   text,
  template_html text NOT NULL, -- HTML with {{variable}} placeholders
  variables     jsonb NOT NULL DEFAULT '[]',
  is_system     boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  use_count     integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_all_select" ON document_templates FOR SELECT
  USING (is_system = true OR org_id = auth.get_org_id());
CREATE POLICY "templates_org_write" ON document_templates FOR ALL
  USING (org_id = auth.get_org_id()) WITH CHECK (org_id = auth.get_org_id());

-- ── Generated Documents ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generated_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id        uuid REFERENCES leads(id) ON DELETE SET NULL,
  template_id    uuid REFERENCES document_templates(id),
  generated_html text NOT NULL,
  generated_by   uuid NOT NULL REFERENCES profiles(id),
  sent_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generated_docs_org" ON generated_documents FOR ALL
  USING (org_id = auth.get_org_id()) WITH CHECK (org_id = auth.get_org_id());

-- ── NPS Responses ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nps_responses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id               uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lo_id                 uuid REFERENCES profiles(id),
  score                 integer CHECK (score BETWEEN 1 AND 10),
  sent_at               timestamptz NOT NULL DEFAULT now(),
  responded_at          timestamptz,
  review_requested_at   timestamptz,
  review_link_clicked   boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nps_org" ON nps_responses FOR ALL
  USING (org_id = auth.get_org_id()) WITH CHECK (org_id = auth.get_org_id());

-- ── Email Integrations (Gmail / Outlook) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_integrations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider                text NOT NULL CHECK (provider IN ('gmail','outlook')),
  email_address           text NOT NULL,
  access_token_encrypted  text,
  refresh_token_encrypted text,
  token_expires_at        timestamptz,
  last_sync_at            timestamptz,
  active                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, profile_id, provider)
);

ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_integrations_org" ON email_integrations FOR ALL
  USING (org_id = auth.get_org_id()) WITH CHECK (org_id = auth.get_org_id());

-- ── Social DM Accounts ────────────────────────────────────────────────────────
-- Stores connected Instagram/Facebook accounts per org for DM routing
CREATE TABLE IF NOT EXISTS social_dm_accounts (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform               text NOT NULL CHECK (platform IN ('instagram','facebook','linkedin','twitter')),
  account_id             text NOT NULL,
  account_name           text NOT NULL,
  access_token_encrypted text,
  connected_at           timestamptz NOT NULL DEFAULT now(),
  active                 boolean NOT NULL DEFAULT true,
  UNIQUE (org_id, platform, account_id)
);
ALTER TABLE social_dm_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_dm_org" ON social_dm_accounts
  FOR ALL
  USING  (org_id = auth.get_org_id())
  WITH CHECK (org_id = auth.get_org_id());

-- Extend inbound_messages with social_platform column
ALTER TABLE inbound_messages
  ADD COLUMN IF NOT EXISTS social_platform text,   -- 'instagram' | 'facebook' | null
  ADD COLUMN IF NOT EXISTS external_id    text;    -- Meta message ID / Twilio SID

-- ── pg_cron: weekly performance email ─────────────────────────────────────────
-- Runs every Monday at 7:30am UTC
-- Requires pg_cron extension to be enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'weekly-performance-email',
      '30 7 * * 1',
      format(
        $$SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            ''Authorization'', ''Bearer '' || current_setting(''app.service_role_key''),
            ''Content-Type'', ''application/json''
          ),
          body := ''{}''::jsonb
        )$$,
        current_setting('app.supabase_functions_url', true) || '/weekly-performance-email'
      )
    );
  END IF;
END;
$$;
