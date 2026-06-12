-- Phase 87 — voicemail call records + realtime notifications.
-- Reuses the existing `notifications` table as the event store (no new notification_log).

-- Enable Supabase Realtime on notifications so the toaster receives INSERTs live.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END$$;

-- INSERT-only voicemail/call records (compliance).
CREATE TABLE IF NOT EXISTS call_records (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES profiles(id) ON DELETE SET NULL,
  lead_id              UUID REFERENCES leads(id) ON DELETE SET NULL,
  caller_number        TEXT NOT NULL,
  direction            TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  duration_seconds     INT,
  recording_url        TEXT,
  transcript           TEXT,
  ashley_sms_sent      BOOLEAN NOT NULL DEFAULT FALSE,
  ashley_sms_body      TEXT,
  ashley_sms_sent_at   TIMESTAMPTZ,
  pipeline_ms          INT,
  twilio_call_sid      TEXT UNIQUE,
  deepgram_request_id  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_records_org ON call_records (org_id, created_at DESC);

ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_records_org_select" ON call_records
  FOR SELECT USING (org_id = public.get_org_id());
CREATE POLICY "call_records_service_insert" ON call_records
  FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "call_records_service_update" ON call_records
  FOR UPDATE USING (TRUE);
REVOKE DELETE, TRUNCATE ON call_records FROM PUBLIC, anon, authenticated, service_role;
