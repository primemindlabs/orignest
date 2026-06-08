-- ============================================================
-- Orignest — pg_cron Setup for AI Agent Schedules
-- 2026-06-01
-- Replace YOUR_PROJECT and SERVICE_ROLE_KEY before running.
-- ============================================================

-- Enable pg_cron (requires Supabase Pro plan or self-hosted with pg_cron installed)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable http extension for net.http_post calls
CREATE EXTENSION IF NOT EXISTS http;

-- ============================================================
-- Morning briefing: 7am daily
-- ============================================================
SELECT cron.schedule(
  'morning-briefing',
  '0 7 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/morning-briefing-cron',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- Speed to contact monitor: every 5 minutes
-- ============================================================
SELECT cron.schedule(
  'speed-to-contact',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/speed-to-contact-monitor',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- TRID monitor: 6am daily
-- ============================================================
SELECT cron.schedule(
  'trid-monitor',
  '0 6 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/trid-monitor',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- Rate watch scan: hourly
-- ============================================================
SELECT cron.schedule(
  'rate-watch',
  '0 * * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/rate-watch-scan',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- Document chase: 9am daily
-- ============================================================
SELECT cron.schedule(
  'document-chase',
  '0 9 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/document-chase',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- Automation runner: every 15 minutes
-- ============================================================
SELECT cron.schedule(
  'automation-runner',
  '*/15 * * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/automation-runner',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- LO performance snapshots: 11:59pm daily
-- ============================================================
SELECT cron.schedule(
  'lo-snapshots',
  '59 23 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/lo-performance-snapshot',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- Post-close retention: 10am daily
-- ============================================================
SELECT cron.schedule(
  'post-close-retention',
  '0 10 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/post-close-retention',
    headers := '{"Authorization":"Bearer SERVICE_ROLE_KEY","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);

-- ============================================================
-- Nightly days_in_stage maintenance (already defined in security hardening)
-- ============================================================
SELECT cron.schedule(
  'update-days-in-stage',
  '0 2 * * *',
  $$SELECT update_lead_days_in_stage()$$
);
