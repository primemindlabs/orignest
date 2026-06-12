-- =============================================================================
-- 021_cron_jobs.sql  —  pg_cron registration for Phases 127–133 + realtor heat
-- =============================================================================
-- Registers the six scheduled jobs that drive the AI suite. Each posts (via
-- pg_net) to a Supabase Edge Function. REQUIRES, set once per project:
--   alter database postgres set app.supabase_functions_url = 'https://<ref>.functions.supabase.co';
--   alter database postgres set app.service_role_key       = '<service-role-key>';
-- and the named edge functions to be deployed. Until then the jobs run but the
-- HTTP POST 404s/401s harmlessly.
--
-- NOTE: realtor-heat-score-nightly here targets the Edge Function
-- /recalculate-realtor-heat-scores. Phase 95 also shipped a Next.js route
-- (/api/cron/realtor-heat-scores, CRON_SECRET) — use ONE of the two, not both.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any pre-existing jobs with these names before re-registering.
do $$
declare r record;
begin
  for r in
    select jobname from cron.job
    where jobname = any (array[
      'generate-autopilot-queue',
      'nightly-intelligence-refresh',
      'business-pulse-daily',
      'goldmine-weekly-scan',
      'update-market-rates',
      'realtor-heat-score-nightly'
    ])
  loop
    perform cron.unschedule(r.jobname);
  end loop;
end $$;

-- Helper-free registration. Each body POSTs to the matching edge function.
select cron.schedule('generate-autopilot-queue', '45 23 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_functions_url') || '/generate-autopilot-queue',
    headers := jsonb_build_object('Content-Type','application/json',
               'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb);
$$);

select cron.schedule('nightly-intelligence-refresh', '0 3 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_functions_url') || '/refresh-loan-intelligence',
    headers := jsonb_build_object('Content-Type','application/json',
               'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb);
$$);

select cron.schedule('business-pulse-daily', '0 6 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_functions_url') || '/compute-business-pulse',
    headers := jsonb_build_object('Content-Type','application/json',
               'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb);
$$);

select cron.schedule('goldmine-weekly-scan', '0 0 * * 0', $$
  select net.http_post(
    url := current_setting('app.supabase_functions_url') || '/scan-goldmine',
    headers := jsonb_build_object('Content-Type','application/json',
               'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb);
$$);

select cron.schedule('update-market-rates', '0 8 * * 4', $$
  select net.http_post(
    url := current_setting('app.supabase_functions_url') || '/update-market-rates',
    headers := jsonb_build_object('Content-Type','application/json',
               'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb);
$$);

select cron.schedule('realtor-heat-score-nightly', '0 7 * * *', $$
  select net.http_post(
    url := current_setting('app.supabase_functions_url') || '/recalculate-realtor-heat-scores',
    headers := jsonb_build_object('Content-Type','application/json',
               'Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := '{}'::jsonb);
$$);

-- Verify:  select jobname, schedule from cron.job order by jobname;
