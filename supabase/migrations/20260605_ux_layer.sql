-- ============================================================
-- Conduit UX Delight Layer — DB additions
-- AI feedback learning loop + notification read tracking
-- Run: supabase db push
-- ============================================================

-- ── AI compose feedback (learning loop foundation) ────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  lead_id    uuid REFERENCES leads(id) ON DELETE SET NULL,
  field_type text NOT NULL,
  prompt_used text NOT NULL,
  ai_output  text NOT NULL,
  user_action text NOT NULL CHECK (user_action IN ('accepted','rejected','modified','ignored')),
  final_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_feedback_org"
  ON ai_feedback
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Notification read tracking ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_reads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id           text NOT NULL,
  notification_type text NOT NULL,
  reference_id      text,
  read_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_type, reference_id)
);

ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_reads_org"
  ON notification_reads
  FOR ALL
  USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ── Index for notification reads lookup ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notification_reads_user
  ON notification_reads (user_id, notification_type, reference_id);

-- ── Index for uncontacted leads query (SpeedTicker) ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_uncontacted
  ON leads (org_id, stage, first_contacted_at, created_at)
  WHERE stage = 'new_inquiry' AND first_contacted_at IS NULL;

-- ── Index for today view priority queue ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_trid_deadlines
  ON leads (org_id, le_deadline, cd_deadline)
  WHERE le_deadline IS NOT NULL OR cd_deadline IS NOT NULL;

-- ── Update ai_feedback user_action default ────────────────────────────────────
-- Allow updating user_action when user accepts/rejects (not an audit log)
-- No special policy needed — governed by org_id RLS above
