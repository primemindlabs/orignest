-- =============================================================================
-- Phase 95 — pg_cron registration for nightly realtor heat-score recalc.
-- =============================================================================
-- NOT auto-applied: it depends on this project's deployed app URL + CRON_SECRET,
-- which aren't known to the migration. Run ONCE in the Supabase SQL editor after
-- setting the two settings below. Mirrors how the other app crons are triggered
-- (POST to a CRON_SECRET-gated /api/cron/* route via pg_net).
--
-- Posts daily at 7:00 AM UTC to /api/cron/realtor-heat-scores, which recomputes
-- every non-archived realtor across all orgs.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One-time config (replace values, then run). CRON_SECRET must match the env var
-- set in Vercel for the app.
--   alter database postgres set app.base_url    = 'https://app.ashleyiq.com';
--   alter database postgres set app.cron_secret = '<same value as Vercel CRON_SECRET>';
--   -- reconnect (or run from a fresh session) so current_setting() sees them.

select cron.schedule(
  'recalculate-realtor-heat-scores',
  '0 7 * * *',
  $$
    select net.http_post(
      url     := current_setting('app.base_url') || '/api/cron/realtor-heat-scores',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.cron_secret')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Verify:        select * from cron.job where jobname = 'recalculate-realtor-heat-scores';
-- Inspect runs:  select * from cron.job_run_details order by start_time desc limit 5;
-- Remove:        select cron.unschedule('recalculate-realtor-heat-scores');
