-- ============================================================
-- Ashley IQ — Phase 30 · Wave 2: Pipeline Intelligence
-- 2026-06-09
--
-- 30.5 Borrower Behavioral Close Score + 30.6 Pipeline Velocity Predictor.
--
-- Schema translated to real columns: tenant_id -> org_id; auth.uid() RLS ->
-- public.get_org_id(); INSERT-only audit tables REVOKE upd/del/trunc.
--
-- 30.5 score is deterministic arithmetic, so it runs as a pure-plpgsql daily
-- cron (compute_behavior_scores), matching this project's working cron pattern.
-- Signals are derived from what actually exists: borrower_portal_tokens
-- (page_views, last_accessed_at), portal_messages (LO->borrower response time),
-- documents (first-doc speed). There is no quiz/education log yet, so the
-- education component is 0 until one exists (honest gate, not faked).
--
-- 30.6 velocity needs Claude (Haiku) per loan, so it is generated on-demand /
-- via a cron-callable API route — not in SQL. This migration only creates the
-- table it writes to.
-- ============================================================

-- ============================================================
-- 30.5 — borrower_behavior_scores (current snapshot, one per lead)
-- ============================================================
CREATE TABLE IF NOT EXISTS borrower_behavior_scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score       integer NOT NULL CHECK (score BETWEEN 0 AND 100),
  tier        text NOT NULL CHECK (tier IN ('high','medium','at_risk')),
  portal_logins_7d        integer NOT NULL DEFAULT 0,
  docs_uploaded_24h       integer NOT NULL DEFAULT 0,
  days_to_first_doc       integer,
  quiz_completed          boolean NOT NULL DEFAULT false,
  messages_responded_to   integer NOT NULL DEFAULT 0,
  avg_response_hours      numeric(6,1),
  rate_options_viewed     integer NOT NULL DEFAULT 0,
  days_since_last_login   integer,
  score_components        jsonb NOT NULL DEFAULT '{}',
  computed_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);
CREATE INDEX IF NOT EXISTS idx_bbs_org_tier ON borrower_behavior_scores(org_id, tier);
ALTER TABLE borrower_behavior_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bbs_select" ON borrower_behavior_scores;
CREATE POLICY "bbs_select" ON borrower_behavior_scores FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "bbs_write" ON borrower_behavior_scores;
CREATE POLICY "bbs_write" ON borrower_behavior_scores FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- 30.5 — behavior_score_history (INSERT-only trend log)
-- ============================================================
CREATE TABLE IF NOT EXISTS behavior_score_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score       integer NOT NULL,
  tier        text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bsh_lead ON behavior_score_history(lead_id, recorded_at DESC);
ALTER TABLE behavior_score_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bsh_select" ON behavior_score_history;
CREATE POLICY "bsh_select" ON behavior_score_history FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "bsh_insert" ON behavior_score_history;
CREATE POLICY "bsh_insert" ON behavior_score_history FOR INSERT WITH CHECK (TRUE);
REVOKE UPDATE, DELETE, TRUNCATE ON behavior_score_history FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON behavior_score_history FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON behavior_score_history FROM service_role;

-- ============================================================
-- 30.6 — velocity_predictions
-- ============================================================
CREATE TABLE IF NOT EXISTS velocity_predictions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  predicted_close_date date NOT NULL,
  confidence_interval_days integer NOT NULL DEFAULT 4,
  days_behind_typical  integer NOT NULL DEFAULT 0,
  risk_level          text NOT NULL CHECK (risk_level IN ('on_track','watch','at_risk','critical')),
  risk_factors        jsonb NOT NULL DEFAULT '[]',
  recommendation      text,
  model_input         jsonb,
  generated_at        timestamptz NOT NULL DEFAULT now(),
  accuracy_days       integer
);
CREATE INDEX IF NOT EXISTS idx_vp_lead ON velocity_predictions(lead_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vp_risk ON velocity_predictions(org_id, risk_level) WHERE risk_level IN ('at_risk','critical');
ALTER TABLE velocity_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vp_select" ON velocity_predictions;
CREATE POLICY "vp_select" ON velocity_predictions FOR SELECT USING (org_id = public.get_org_id());
DROP POLICY IF EXISTS "vp_write" ON velocity_predictions;
CREATE POLICY "vp_write" ON velocity_predictions FOR ALL USING (org_id = public.get_org_id()) WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- 30.5 — compute_behavior_scores(): daily pure-SQL scoring flywheel
-- Returns the number of leads whose score moved >= 5 points (history rows).
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_behavior_scores()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_changed integer := 0;
BEGIN
  CREATE TEMP TABLE _new_scores ON COMMIT DROP AS
  WITH active AS (
    SELECT l.id AS lead_id, l.org_id, l.created_at
    FROM leads l
    WHERE l.stage NOT IN ('closed','declined','withdrawn') AND l.archived_at IS NULL
  ),
  portal AS (
    SELECT lead_id, max(page_views) AS page_views, max(last_accessed_at) AS last_accessed
    FROM borrower_portal_tokens GROUP BY lead_id
  ),
  docs AS (
    SELECT lead_id, min(created_at) AS first_doc_at,
      count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS docs_24h
    FROM documents GROUP BY lead_id
  ),
  msg AS (
    SELECT lead_id, sender_type, created_at,
      lag(sender_type) OVER (PARTITION BY lead_id ORDER BY created_at) AS prev_sender,
      lag(created_at) OVER (PARTITION BY lead_id ORDER BY created_at) AS prev_at
    FROM portal_messages
  ),
  resp AS (
    SELECT lead_id,
      avg(EXTRACT(EPOCH FROM (created_at - prev_at))/3600.0) AS avg_hours,
      count(*) AS responded
    FROM msg
    WHERE sender_type = 'borrower' AND prev_sender IN ('lo','loan_officer','staff','user')
    GROUP BY lead_id
  ),
  sig AS (
    SELECT a.lead_id, a.org_id,
      COALESCE(p.page_views, 0) AS page_views,
      p.last_accessed,
      CASE WHEN p.last_accessed IS NULL THEN NULL
           ELSE floor(EXTRACT(EPOCH FROM (now() - p.last_accessed))/86400.0)::int END AS days_since_login,
      CASE WHEN d.first_doc_at IS NULL THEN NULL
           ELSE GREATEST(0, floor(EXTRACT(EPOCH FROM (d.first_doc_at - a.created_at))/86400.0)::int) END AS days_to_first_doc,
      COALESCE(d.docs_24h, 0)::int AS docs_24h,
      r.avg_hours AS avg_response_hours,
      COALESCE(r.responded, 0)::int AS messages_responded
    FROM active a
    LEFT JOIN portal p ON p.lead_id = a.lead_id
    LEFT JOIN docs d   ON d.lead_id = a.lead_id
    LEFT JOIN resp r   ON r.lead_id = a.lead_id
  ),
  comp AS (
    SELECT s.*,
      (CASE WHEN s.page_views >= 10 THEN 30
            WHEN s.page_views >= 3 THEN 20
            WHEN s.days_since_login IS NOT NULL AND s.days_since_login <= 3 THEN 15
            ELSE 0 END) AS c_engagement,
      (CASE WHEN s.avg_response_hours IS NULL THEN 12
            WHEN s.avg_response_hours <= 4 THEN 25
            WHEN s.avg_response_hours <= 24 THEN 18
            WHEN s.avg_response_hours <= 72 THEN 10
            ELSE 3 END) AS c_responsiveness,
      (CASE WHEN s.days_to_first_doc IS NULL THEN 12
            WHEN s.days_to_first_doc <= 1 THEN 25
            WHEN s.days_to_first_doc <= 3 THEN 18
            WHEN s.days_to_first_doc <= 7 THEN 10
            ELSE 2 END) AS c_document_speed,
      0 AS c_education,
      (CASE WHEN s.days_since_login IS NULL THEN 5
            WHEN s.days_since_login = 0 THEN 10
            WHEN s.days_since_login <= 2 THEN 8
            WHEN s.days_since_login <= 7 THEN 5
            ELSE 0 END) AS c_recency
    FROM sig s
  )
  SELECT lead_id, org_id, page_views, last_accessed, days_since_login, days_to_first_doc, docs_24h,
    avg_response_hours, messages_responded,
    c_engagement, c_responsiveness, c_document_speed, c_education, c_recency,
    (c_engagement + c_responsiveness + c_document_speed + c_education + c_recency) AS score
  FROM comp;

  -- Append a history row when the score moved >= 5 points (or is brand new).
  INSERT INTO behavior_score_history (lead_id, org_id, score, tier)
  SELECT ns.lead_id, ns.org_id, ns.score,
    CASE WHEN ns.score >= 70 THEN 'high' WHEN ns.score >= 40 THEN 'medium' ELSE 'at_risk' END
  FROM _new_scores ns
  LEFT JOIN borrower_behavior_scores bs ON bs.lead_id = ns.lead_id
  WHERE bs.score IS NULL OR abs(bs.score - ns.score) >= 5;
  GET DIAGNOSTICS n_changed = ROW_COUNT;

  -- Upsert the current snapshot.
  INSERT INTO borrower_behavior_scores (
    lead_id, org_id, score, tier, portal_logins_7d, docs_uploaded_24h, days_to_first_doc,
    quiz_completed, messages_responded_to, avg_response_hours, rate_options_viewed,
    days_since_last_login, score_components, computed_at
  )
  SELECT ns.lead_id, ns.org_id, ns.score,
    CASE WHEN ns.score >= 70 THEN 'high' WHEN ns.score >= 40 THEN 'medium' ELSE 'at_risk' END,
    CASE WHEN ns.last_accessed IS NOT NULL AND ns.last_accessed > now() - interval '7 days' THEN 1 ELSE 0 END,
    ns.docs_24h, ns.days_to_first_doc, false, ns.messages_responded,
    round(ns.avg_response_hours, 1), 0, ns.days_since_login,
    jsonb_build_object('engagement', ns.c_engagement, 'responsiveness', ns.c_responsiveness,
      'document_speed', ns.c_document_speed, 'education', ns.c_education, 'recency', ns.c_recency),
    now()
  FROM _new_scores ns
  ON CONFLICT (lead_id) DO UPDATE SET
    org_id = EXCLUDED.org_id, score = EXCLUDED.score, tier = EXCLUDED.tier,
    portal_logins_7d = EXCLUDED.portal_logins_7d, docs_uploaded_24h = EXCLUDED.docs_uploaded_24h,
    days_to_first_doc = EXCLUDED.days_to_first_doc, messages_responded_to = EXCLUDED.messages_responded_to,
    avg_response_hours = EXCLUDED.avg_response_hours, days_since_last_login = EXCLUDED.days_since_last_login,
    score_components = EXCLUDED.score_components, computed_at = now();

  RETURN n_changed;
END; $$;
REVOKE ALL ON FUNCTION public.compute_behavior_scores() FROM PUBLIC;

-- Daily: 06:00 UTC
SELECT cron.schedule('behavior-score-daily', '0 6 * * *', $$SELECT public.compute_behavior_scores()$$);

-- ============================================================
-- 30.6 — daily velocity batch (07:00 UTC).
-- Calls the Next.js cron route on the production deployment; it self-authorizes
-- with the shared CRON_SECRET. The secret must be set BOTH as a Vercel env var
-- (CRON_SECRET) AND as a DB setting so the header matches:
--     ALTER DATABASE postgres SET app.cron_secret = '<same-value>';
-- Until app.cron_secret is set, the route returns 401 and no predictions are
-- written by cron (LOs can still regenerate on-demand from the loan file).
-- ============================================================
SELECT cron.schedule(
  'velocity-predictor-daily',
  '0 7 * * *',
  $$SELECT net.http_post(
      url := 'https://ashleyiq.vercel.app/api/cron/velocity-predictions',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || coalesce(current_setting('app.cron_secret', true), ''),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
  )$$
);
