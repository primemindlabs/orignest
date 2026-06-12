/**
 * Phase 97 — abandon-recovery cron. Runs every ~30 min (pg_cron/pg_net → here,
 * CRON_SECRET bearer) to send the next eligible recovery SMS for incomplete 1003
 * sessions. Twilio-gated record-only when creds are absent.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processAbandonedSessions } from '@/lib/abandonRecovery/processAbandonedSessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();
  const result = await processAbandonedSessions(sb);
  return NextResponse.json({ ok: true, ...result });
}
