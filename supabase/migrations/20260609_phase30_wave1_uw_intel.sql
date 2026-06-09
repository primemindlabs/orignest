-- ============================================================
-- Ashley IQ — Phase 30 · Wave 1: UW Intelligence
-- 2026-06-09
--
-- 30.1 Condition Prediction Engine + 30.4 Underwriting Outcome Learning.
--
-- Translated from the generic Phase-30 spec to this codebase's real schema:
--   • tenant_id            -> org_id uuid REFERENCES organizations(id)
--   • auth.uid()/users RLS -> public.get_org_id()
--   • uw_conditions        -> loan_conditions (the real conditions table)
--   • uw_decisions         -> uw_files.decision
--   • "funded" loans       -> leads.stage = 'closed' (no 'funded' stage exists)
--
-- The learner (30.4) is implemented as a pure-plpgsql function on pg_cron —
-- matching the project's working cron pattern (recompute_lead_scores,
-- snapshot_portfolios). The edge-function crons in this project are broken
-- placeholders (YOUR_PROJECT_REF), so aggregation jobs stay in SQL where they
-- actually run. Condition *prediction* (30.1) needs Claude and runs on-demand
-- from an API route, reading the patterns this learner produces.
--
-- Pattern key (consistent between learner + predictor):
--   loan_type | occupancy_type | ltv_band
-- (employment_type lives in loan_applications jsonb and is not reliably
--  SQL-aggregable, so it is omitted from the SQL learner's key.)
-- ============================================================

-- ============================================================
-- 30.1 — predicted_conditions
-- ============================================================
CREATE TABLE IF NOT EXISTS predicted_conditions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  model_version   text NOT NULL DEFAULT 'claude-sonnet-4-5',
  -- Each prediction: { condition_text, category, probability, reasoning, source }
  -- categories: income | assets | credit | property | program | compliance | other
  -- probability: 0.0–1.0 ; source: historical_pattern | program_guideline | loan_profile
  predictions     jsonb NOT NULL DEFAULT '[]',
  lo_reviewed     boolean NOT NULL DEFAULT false,
  lo_reviewed_at  timestamptz,
  lo_reviewed_by  uuid REFERENCES profiles(id),
  -- filled post-close: fraction of predictions (>=0.5) that materialized as real conditions
  accuracy_score  numeric(3,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predicted_conditions_lead ON predicted_conditions(lead_id);
CREATE INDEX IF NOT EXISTS idx_predicted_conditions_org  ON predicted_conditions(org_id, generated_at DESC);

ALTER TABLE predicted_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "predicted_conditions_select" ON predicted_conditions;
CREATE POLICY "predicted_conditions_select" ON predicted_conditions
  FOR SELECT USING (org_id = public.get_org_id());

DROP POLICY IF EXISTS "predicted_conditions_write" ON predicted_conditions;
CREATE POLICY "predicted_conditions_write" ON predicted_conditions
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- 30.4 — uw_outcome_patterns (the flywheel)
-- ============================================================
CREATE TABLE IF NOT EXISTS uw_outcome_patterns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pattern_key     text NOT NULL,            -- e.g. "fha|primary_residence|90-95"
  -- [{ condition_text, category, frequency_pct, avg_days_to_satisfy }]
  common_conditions jsonb NOT NULL DEFAULT '[]',
  avg_days_to_clear_conditions integer,
  avg_days_total_uw            integer,
  approval_rate   numeric(4,3),
  suspension_rate numeric(4,3),
  denial_rate     numeric(4,3),
  loan_count      integer NOT NULL DEFAULT 0,
  last_updated    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, pattern_key)
);

CREATE INDEX IF NOT EXISTS idx_uw_outcome_patterns_org ON uw_outcome_patterns(org_id, pattern_key);

ALTER TABLE uw_outcome_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uw_outcome_patterns_select" ON uw_outcome_patterns;
CREATE POLICY "uw_outcome_patterns_select" ON uw_outcome_patterns
  FOR SELECT USING (org_id = public.get_org_id());

DROP POLICY IF EXISTS "uw_outcome_patterns_write" ON uw_outcome_patterns;
CREATE POLICY "uw_outcome_patterns_write" ON uw_outcome_patterns
  FOR ALL USING (org_id = public.get_org_id())
  WITH CHECK (org_id = public.get_org_id());

-- ============================================================
-- 30.4 — uw_pattern_refresh_log (INSERT-only audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS uw_pattern_refresh_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patterns_updated integer NOT NULL DEFAULT 0,
  loans_analyzed   integer NOT NULL DEFAULT 0,
  ran_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uw_pattern_refresh_log_org ON uw_pattern_refresh_log(org_id, ran_at DESC);

ALTER TABLE uw_pattern_refresh_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uw_pattern_refresh_log_select" ON uw_pattern_refresh_log;
CREATE POLICY "uw_pattern_refresh_log_select" ON uw_pattern_refresh_log
  FOR SELECT USING (org_id = public.get_org_id());

DROP POLICY IF EXISTS "uw_pattern_refresh_log_insert" ON uw_pattern_refresh_log;
CREATE POLICY "uw_pattern_refresh_log_insert" ON uw_pattern_refresh_log
  FOR INSERT WITH CHECK (TRUE);

REVOKE UPDATE, DELETE, TRUNCATE ON uw_pattern_refresh_log FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON uw_pattern_refresh_log FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON uw_pattern_refresh_log FROM service_role;

-- ============================================================
-- 30.4 — learn_uw_patterns(): pure-SQL flywheel (runs on pg_cron)
-- Mines closed/declined loans + their conditions into uw_outcome_patterns.
-- min_count default 3 (spec says 5; lowered so sparse early data still
-- surfaces a few patterns — raise as volume grows).
-- ============================================================
DROP FUNCTION IF EXISTS public.learn_uw_patterns(integer);
CREATE OR REPLACE FUNCTION public.learn_uw_patterns(min_count integer DEFAULT 3)
-- OUT columns are prefixed out_* so they never collide with the table columns
-- (org_id, patterns_updated, loans_analyzed) referenced inside the body.
RETURNS TABLE(out_org_id uuid, out_patterns_updated integer, out_loans_analyzed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Pattern key = loan_type | occupancy_type | ltv_band, scoped per org.
  -- "Decided" loans = reached a terminal-ish UW outcome.
  CREATE TEMP TABLE _scoped_loans ON COMMIT DROP AS
  SELECT
    l.id           AS lead_id,
    l.org_id       AS org_id,
    lower(coalesce(l.loan_type,'unknown')) || '|' ||
    lower(coalesce(l.occupancy_type,'unknown')) || '|' ||
    CASE
      WHEN l.ltv IS NULL      THEN 'unknown'
      WHEN l.ltv <= 80        THEN '<=80'
      WHEN l.ltv <= 90        THEN '80-90'
      WHEN l.ltv <= 95        THEN '90-95'
      ELSE                         '>95'
    END            AS pattern_key,
    l.stage        AS stage,
    uf.decision    AS decision,
    uf.created_at  AS uw_started_at,
    uf.decided_at  AS uw_decided_at
  FROM leads l
  LEFT JOIN uw_files uf ON uf.lead_id = l.id
  WHERE l.stage IN ('closed','clear_to_close','conditional_approval','underwriting','declined','withdrawn')
    AND l.archived_at IS NULL;

  -- Aggregate per (org, pattern_key); upsert groups meeting the min sample size.
  FOR r IN
    SELECT
      s.org_id      AS p_org_id,
      s.pattern_key AS p_key,
      count(*)                                            AS loan_count,
      avg(EXTRACT(EPOCH FROM (s.uw_decided_at - s.uw_started_at)) / 86400.0)
        FILTER (WHERE s.uw_decided_at IS NOT NULL)        AS avg_days_total_uw,
      avg(CASE WHEN s.stage = 'closed' OR s.decision IN ('approve','approved','clear_to_close') THEN 1.0 ELSE 0.0 END) AS approval_rate,
      avg(CASE WHEN s.decision IN ('suspend','suspended') THEN 1.0 ELSE 0.0 END) AS suspension_rate,
      avg(CASE WHEN s.stage = 'declined' OR s.decision IN ('deny','denied') THEN 1.0 ELSE 0.0 END) AS denial_rate
    FROM _scoped_loans s
    GROUP BY s.org_id, s.pattern_key
    HAVING count(*) >= min_count
  LOOP
    INSERT INTO uw_outcome_patterns (
      org_id, pattern_key, common_conditions,
      avg_days_to_clear_conditions, avg_days_total_uw,
      approval_rate, suspension_rate, denial_rate, loan_count, last_updated
    )
    VALUES (
      r.p_org_id, r.p_key,
      -- condition frequencies across the loans in this pattern group
      COALESCE((
        SELECT jsonb_agg(c ORDER BY (c->>'frequency_pct')::numeric DESC)
        FROM (
          SELECT jsonb_build_object(
            'condition_text', lc.condition_text,
            'category', max(lc.category),
            'frequency_pct', round(100.0 * count(DISTINCT lc.lead_id) / r.loan_count, 0),
            'avg_days_to_satisfy', round(avg(EXTRACT(EPOCH FROM (lc.cleared_at - lc.created_at))/86400.0)
              FILTER (WHERE lc.cleared_at IS NOT NULL))
          ) AS c
          FROM loan_conditions lc
          JOIN _scoped_loans s2 ON s2.lead_id = lc.lead_id
          WHERE s2.org_id = r.p_org_id AND s2.pattern_key = r.p_key
          GROUP BY lc.condition_text
          HAVING count(DISTINCT lc.lead_id) >= 1
          ORDER BY count(DISTINCT lc.lead_id) DESC
          LIMIT 25
        ) q
      ), '[]'::jsonb),
      (SELECT round(avg(EXTRACT(EPOCH FROM (lc.cleared_at - lc.created_at))/86400.0))::int
         FROM loan_conditions lc
         JOIN _scoped_loans s3 ON s3.lead_id = lc.lead_id
        WHERE s3.org_id = r.p_org_id AND s3.pattern_key = r.p_key AND lc.cleared_at IS NOT NULL),
      r.avg_days_total_uw::int,
      round(r.approval_rate, 3), round(r.suspension_rate, 3), round(r.denial_rate, 3),
      r.loan_count, now()
    )
    ON CONFLICT (org_id, pattern_key) DO UPDATE SET
      common_conditions = EXCLUDED.common_conditions,
      avg_days_to_clear_conditions = EXCLUDED.avg_days_to_clear_conditions,
      avg_days_total_uw = EXCLUDED.avg_days_total_uw,
      approval_rate = EXCLUDED.approval_rate,
      suspension_rate = EXCLUDED.suspension_rate,
      denial_rate = EXCLUDED.denial_rate,
      loan_count = EXCLUDED.loan_count,
      last_updated = now();
  END LOOP;

  -- One refresh-log row per org that had any scoped loans.
  RETURN QUERY
  WITH per_org AS (
    SELECT s.org_id AS po_org_id,
           (SELECT count(*) FROM uw_outcome_patterns p WHERE p.org_id = s.org_id)::int AS pcount,
           count(*)::int AS lcount
    FROM _scoped_loans s
    GROUP BY s.org_id
  ), logged AS (
    INSERT INTO uw_pattern_refresh_log (org_id, patterns_updated, loans_analyzed)
    SELECT per_org.po_org_id, per_org.pcount, per_org.lcount FROM per_org
    RETURNING uw_pattern_refresh_log.org_id, uw_pattern_refresh_log.patterns_updated, uw_pattern_refresh_log.loans_analyzed
  )
  SELECT logged.org_id, logged.patterns_updated, logged.loans_analyzed FROM logged;
END;
$$;

REVOKE ALL ON FUNCTION public.learn_uw_patterns(integer) FROM PUBLIC;

-- Weekly: Sunday 03:00 UTC
SELECT cron.schedule('uw-outcome-learning', '0 3 * * 0', $$SELECT public.learn_uw_patterns()$$);
