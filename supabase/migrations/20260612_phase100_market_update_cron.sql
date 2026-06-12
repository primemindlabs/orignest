-- =============================================================================
-- Phase 100 — pg_cron sidecar for the weekly realtor market-update draft.
-- =============================================================================
-- NOT auto-applied: needs this project's deployed URL + CRON_SECRET. Run ONCE in
-- the Supabase SQL editor after setting the two settings below. Posts every
-- Monday 06:00 UTC to /api/cron/market-update-draft (when that endpoint exists)
-- to auto-generate a DRAFT for LOs with auto_send_enabled — never auto-sends; the
-- LO always reviews and approves the send.
--
-- NOTE: the draft-generation cron endpoint is not built in this phase (auto-send
-- is opt-in and the manual generate flow is the shipped path). Register this once
-- the /api/cron/market-update-draft route is added.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One-time config:
--   alter database postgres set app.settings.api_base_url = 'https://app.ashleyiq.com';
--   alter database postgres set app.settings.cron_secret  = '<same as Vercel CRON_SECRET>';

select cron.schedule(
  'weekly-market-update-draft',
  '0 6 * * 1',
  $$
    select net.http_post(
      url     := current_setting('app.settings.api_base_url') || '/api/cron/market-update-draft',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
        'Content-Type', 'application/json'
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Verify:  select * from cron.job where jobname = 'weekly-market-update-draft';
-- Remove:  select cron.unschedule('weekly-market-update-draft');
