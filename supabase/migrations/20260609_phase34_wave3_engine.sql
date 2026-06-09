-- ============================================================
-- Ashley IQ — Phase 34 · Wave 3: Campaign engine (trigger + crons)
-- 2026-06-09
-- Step processor + auto-enroll run as Next.js cron routes (Bearer CRON_SECRET);
-- pg_cron calls them. Milestone enrollment is a DB trigger.
-- ============================================================

-- 34.6 — milestone enrollment on stage change (uses campaigns.trigger_stage).
CREATE OR REPLACE FUNCTION public.trigger_milestone_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_campaign uuid; v_delay_days int; v_delay_hours int;
BEGIN
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage THEN RETURN NEW; END IF;
  BEGIN
    SELECT id INTO v_campaign FROM campaigns
    WHERE org_id = NEW.org_id AND is_library_template = false AND status = 'active' AND trigger_stage = NEW.stage
    ORDER BY created_at DESC LIMIT 1;
    IF v_campaign IS NULL THEN RETURN NEW; END IF;
    SELECT coalesce(delay_days,0), coalesce(delay_hours,0) INTO v_delay_days, v_delay_hours
    FROM campaign_steps WHERE campaign_id = v_campaign AND step_number = 1;
    INSERT INTO campaign_enrollments (campaign_id, lead_id, org_id, enrolled_by, status, current_step, next_send_at)
    VALUES (v_campaign, NEW.id, NEW.org_id, 'auto_trigger', 'active', 1,
            now() + (coalesce(v_delay_days,0) || ' days')::interval + (coalesce(v_delay_hours,0) || ' hours')::interval)
    ON CONFLICT (campaign_id, lead_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS milestone_campaign_trigger ON leads;
CREATE TRIGGER milestone_campaign_trigger AFTER UPDATE OF stage ON leads FOR EACH ROW EXECUTE FUNCTION public.trigger_milestone_campaign();

-- pg_cron: processor every 30 min; auto-enroll daily (Vercel routes, app.cron_secret).
SELECT cron.schedule('campaign-step-processor', '*/30 * * * *',
  $$SELECT net.http_post(url := 'https://ashleyiq.vercel.app/api/cron/process-campaign-steps',
    headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce(current_setting('app.cron_secret', true), ''), 'Content-Type', 'application/json'), body := '{}'::jsonb)$$);
SELECT cron.schedule('campaign-reactivation-enroll', '0 8 * * *',
  $$SELECT net.http_post(url := 'https://ashleyiq.vercel.app/api/cron/campaign-auto-enroll',
    headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce(current_setting('app.cron_secret', true), ''), 'Content-Type', 'application/json'), body := '{"trigger_type":"reactivation"}'::jsonb)$$);
SELECT cron.schedule('campaign-loan-anniversary-enroll', '0 7 * * *',
  $$SELECT net.http_post(url := 'https://ashleyiq.vercel.app/api/cron/campaign-auto-enroll',
    headers := jsonb_build_object('Authorization', 'Bearer ' || coalesce(current_setting('app.cron_secret', true), ''), 'Content-Type', 'application/json'), body := '{"trigger_type":"loan_anniversary"}'::jsonb)$$);
