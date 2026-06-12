-- =============================================================================
-- Phase 99 — pg_cron registration for the weekly funnel snapshot.
-- =============================================================================
-- NOT auto-applied: depends on this project's deployed URL + CRON_SECRET. Run ONCE
-- in the Supabase SQL editor after setting the two settings below. Posts every
-- Sunday 01:00 UTC to /api/cron/calculate-funnel (CRON_SECRET-gated) via pg_net.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One-time config (replace, then run from a fresh session):
--   alter database postgres set app.settings.api_base_url = 'https://app.ashleyiq.com';
--   alter database postgres set app.settings.cron_secret  = '<same as Vercel CRON_SECRET>';

select cron.schedule(
  'weekly-funnel-snapshot',
  '0 1 * * 0',
  $$
    select net.http_post(
      url     := current_setting('app.settings.api_base_url') || '/api/cron/calculate-funnel',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Verify:  select * from cron.job where jobname = 'weekly-funnel-snapshot';
-- Remove:  select cron.unschedule('weekly-funnel-snapshot');
