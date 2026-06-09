-- ============================================================
-- AshleyIQ v2 — Phase 1.2 follow-up: weekly lead-score recalc
-- 2026-06-08 · idempotent
--
-- The lead score is DETERMINISTIC (see app/api/ai/lead-score/route.ts —
-- calculateScore). Several factors are time-relative (no-contact decay,
-- speed-to-contact), so scores drift stale between manual recomputes. This
-- ports the exact same logic into a SQL function and runs it weekly via
-- pg_cron, the same mechanism as update_lead_days_in_stage.
--
-- KEEP IN SYNC with calculateScore() in the TS route — the two must agree.
-- ============================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.recompute_lead_scores()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  l            record;
  v_score      integer;
  v_loan       integer;
  v_credit     integer;
  v_contact    integer;
  v_sms        integer;
  v_source     integer;
  v_app        integer;
  v_speed      integer;
  v_penalty    integer;
  v_has_penalty boolean;
  v_minutes    numeric;
  v_days       integer;
  v_factors    jsonb;
  v_count      integer := 0;
BEGIN
  FOR l IN
    SELECT id, org_id, loan_amount, credit_score, phone, email, sms_consent,
           lead_source, stage, last_contacted_at, created_at, ai_score
    FROM leads
    WHERE archived_at IS NULL
      AND stage NOT IN ('closed','declined','withdrawn')
  LOOP
    -- Loan amount (max 40)
    v_loan := CASE
      WHEN COALESCE(l.loan_amount,0) >= 400000 THEN 40
      WHEN COALESCE(l.loan_amount,0) >= 300000 THEN 30
      WHEN COALESCE(l.loan_amount,0) >= 200000 THEN 20
      WHEN COALESCE(l.loan_amount,0) >= 100000 THEN 10
      ELSE 5 END;

    -- Credit tier (max 20)
    v_credit := CASE
      WHEN COALESCE(l.credit_score,0) >= 720 THEN 20
      WHEN COALESCE(l.credit_score,0) >= 680 THEN 15
      WHEN COALESCE(l.credit_score,0) >= 640 THEN 10
      WHEN COALESCE(l.credit_score,0) >  0   THEN 5
      ELSE 0 END;

    -- Phone + email (10)
    v_contact := CASE WHEN l.phone IS NOT NULL AND l.email IS NOT NULL THEN 10 ELSE 0 END;

    -- SMS consent (5)
    v_sms := CASE WHEN l.sms_consent THEN 5 ELSE 0 END;

    -- Lead source (max 15)
    v_source := CASE COALESCE(l.lead_source,'other')
      WHEN 'referral' THEN 15
      WHEN 'past_client' THEN 15
      WHEN 'website' THEN 10
      WHEN 'open_house' THEN 10
      WHEN 'cold_outreach' THEN 7
      WHEN 'paid_ad' THEN 7
      WHEN 'zillow' THEN 7
      WHEN 'realtor_com' THEN 7
      WHEN 'social_media' THEN 5
      WHEN 'other' THEN 3
      ELSE 3 END;

    -- Application submitted (15)
    v_app := CASE WHEN l.stage IN
      ('application','processing','underwriting','conditional_approval','clear_to_close','closed')
      THEN 15 ELSE 0 END;

    -- Speed-to-contact bonus (5)
    IF l.last_contacted_at IS NOT NULL AND l.created_at IS NOT NULL THEN
      v_minutes := EXTRACT(EPOCH FROM (l.last_contacted_at - l.created_at)) / 60;
      v_speed := CASE WHEN v_minutes <= 5 THEN 5 ELSE 0 END;
    ELSE
      v_speed := 0;
    END IF;

    -- No-contact decay penalty (max -20) — only present when never contacted
    v_has_penalty := (l.last_contacted_at IS NULL AND l.created_at IS NOT NULL);
    IF v_has_penalty THEN
      v_days := floor(EXTRACT(EPOCH FROM (now() - l.created_at)) / 86400);
      v_penalty := -1 * LEAST(20, v_days * 2);
    ELSE
      v_penalty := 0;
    END IF;

    v_score := GREATEST(0, LEAST(100,
      v_loan + v_credit + v_contact + v_sms + v_source + v_app + v_speed + v_penalty));

    -- Build factors JSON in the exact order/shape the TS route emits.
    v_factors := jsonb_build_array(
      jsonb_build_object('factor','loan_amount','label','Loan amount','contribution',v_loan),
      jsonb_build_object('factor','credit_score','label','Credit tier','contribution',v_credit),
      jsonb_build_object('factor','contact_info','label','Phone + email on file','contribution',v_contact),
      jsonb_build_object('factor','sms_consent','label','SMS consent','contribution',v_sms),
      jsonb_build_object('factor','lead_source','label','Lead source','contribution',v_source),
      jsonb_build_object('factor','application','label','Application submitted','contribution',v_app),
      jsonb_build_object('factor','speed_bonus','label','Fast first contact','contribution',v_speed)
    );
    IF v_has_penalty THEN
      v_factors := v_factors || jsonb_build_array(
        jsonb_build_object('factor','no_contact_penalty','label','No contact yet','contribution',v_penalty));
    END IF;

    UPDATE leads
    SET ai_score = v_score,
        ai_score_updated_at = now(),
        ai_score_factors = v_factors
    WHERE id = l.id
      AND (ai_score IS DISTINCT FROM v_score OR ai_score_factors IS DISTINCT FROM v_factors);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;

-- Schedule weekly: Monday 03:00 UTC. Unschedule first to stay idempotent.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('weekly-lead-score-recalc')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-lead-score-recalc');
    PERFORM cron.schedule(
      'weekly-lead-score-recalc',
      '0 3 * * 1',
      $job$SELECT public.recompute_lead_scores()$job$
    );
  END IF;
END
$do$;

COMMIT;
