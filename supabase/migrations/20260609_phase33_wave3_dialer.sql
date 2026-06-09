-- ============================================================
-- Ashley IQ — Phase 33 · Wave 3: Power Dialer infra + TCPA
-- 2026-06-09
--
-- Adds the Phase 33 session/queue/disposition model + TCPA inputs on top of the
-- existing dialer. Real schema: tenant_id -> org_id; get_org_id() RLS;
-- communication_consents (Phase 31) extended; leads.property_state for tz.
-- ============================================================

-- TCPA inputs.
ALTER TABLE communication_consents
  ADD COLUMN IF NOT EXISTS auto_dial_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_dial_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_dial_consent_method text;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS dnc_flagged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnc_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS dnc_flagged_by text;

CREATE TABLE IF NOT EXISTS dialer_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lo_id           text NOT NULL,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ended_at        timestamptz,
  total_calls     integer NOT NULL DEFAULT 0,
  connected_calls integer NOT NULL DEFAULT 0,
  voicemails_dropped integer NOT NULL DEFAULT 0,
  total_talk_seconds integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ds_org ON dialer_sessions(org_id, started_at DESC);
ALTER TABLE dialer_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ds_select" ON dialer_sessions;
CREATE POLICY "ds_select" ON dialer_sessions FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "ds_write" ON dialer_sessions;
CREATE POLICY "ds_write" ON dialer_sessions FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- Calls: updatable for end-of-call (disposition/duration), never deletable (audit).
CREATE TABLE IF NOT EXISTS dialer_calls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid REFERENCES dialer_sessions(id) ON DELETE SET NULL,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  lo_id           text NOT NULL,
  twilio_call_sid text,
  phone_number_called text NOT NULL,
  local_presence_number text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  answered_at     timestamptz,
  ended_at        timestamptz,
  duration_seconds integer,
  disposition     text CHECK (disposition IN ('connected','voicemail','no_answer','busy','wrong_number','not_interested','callback_requested','do_not_call')),
  voicemail_dropped boolean NOT NULL DEFAULT false,
  recording_sid   text,
  recording_url   text,
  transcript_id   uuid,
  ai_coaching_sessions integer NOT NULL DEFAULT 0,
  tcpa_check_passed boolean NOT NULL DEFAULT false,
  tcpa_check_result jsonb
);
CREATE INDEX IF NOT EXISTS idx_dc_session ON dialer_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_dc_lead ON dialer_calls(lead_id, started_at DESC);
ALTER TABLE dialer_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dc_select" ON dialer_calls;
CREATE POLICY "dc_select" ON dialer_calls FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "dc_ins" ON dialer_calls;
CREATE POLICY "dc_ins" ON dialer_calls FOR INSERT WITH CHECK (org_id = public.get_org_id());
DROP POLICY IF EXISTS "dc_upd" ON dialer_calls;
CREATE POLICY "dc_upd" ON dialer_calls FOR UPDATE USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
REVOKE DELETE, TRUNCATE ON dialer_calls FROM PUBLIC, authenticated, service_role, anon;

CREATE TABLE IF NOT EXISTS call_recordings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL REFERENCES dialer_calls(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  twilio_recording_sid text NOT NULL,
  s3_key          text,
  duration_seconds integer,
  status          text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','failed')),
  recorded_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cr_all" ON call_recordings;
CREATE POLICY "cr_all" ON call_recordings FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS call_transcriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id         uuid NOT NULL REFERENCES dialer_calls(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transcript_text text,
  speaker_segments jsonb,
  ai_summary      text,
  sentiment       text,
  key_topics      jsonb,
  follow_up_suggested text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ct_call ON call_transcriptions(call_id);
ALTER TABLE call_transcriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ct_all" ON call_transcriptions;
CREATE POLICY "ct_all" ON call_transcriptions FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS dialer_queue_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES dialer_sessions(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  position        integer NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','calling','completed','skipped')),
  call_id         uuid REFERENCES dialer_calls(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dqi_session ON dialer_queue_items(session_id, position);
ALTER TABLE dialer_queue_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dqi_all" ON dialer_queue_items;
CREATE POLICY "dqi_all" ON dialer_queue_items FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

CREATE TABLE IF NOT EXISTS voicemail_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      text NOT NULL,
  name            text NOT NULL,
  script          text NOT NULL,
  s3_key          text,
  duration_seconds integer,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE voicemail_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vt_all" ON voicemail_templates;
CREATE POLICY "vt_all" ON voicemail_templates FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());
