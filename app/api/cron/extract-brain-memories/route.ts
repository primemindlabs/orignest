/**
 * Phase 127 — Ashley Brain™ nightly cron.
 *  1) Ingest recent activity (communications / realtor_touches / lead_notes)
 *     into ashley_brain_logs (read-only of sources, deduped).
 *  2) Distill a bounded batch of unprocessed logs into memories.
 * Invoked by Vercel Cron via GET with `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ingestOrg } from '@/lib/brain/ingest';
import { processLog } from '@/lib/brain/logInteraction';
import type { BrainLog } from '@/lib/brain/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PROCESS_BATCH = 60; // cap model calls per run

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();

  // Phase 1 — ingest per org.
  let ingested = 0;
  const { data: orgs } = await sb.from('organizations').select('id').limit(10000);
  for (const org of orgs ?? []) {
    try {
      ingested += await ingestOrg(sb, org.id as string);
    } catch (e) {
      console.error('[cron/extract-brain-memories] ingest', org.id, e);
    }
  }

  // Phase 2 — distill a bounded batch of unprocessed logs (oldest first).
  const { data: logs } = await sb
    .from('ashley_brain_logs')
    .select('id, org_id, lo_id, entity_type, entity_id, log_type, content, raw_metadata')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(PROCESS_BATCH);

  let processed = 0;
  let memories = 0;
  for (const log of logs ?? []) {
    try {
      const ids = await processLog(sb, log as BrainLog);
      processed += 1;
      memories += ids.length;
    } catch (e) {
      console.error('[cron/extract-brain-memories] process', (log as { id?: string }).id, e);
    }
  }

  return NextResponse.json({ orgs: orgs?.length ?? 0, ingested, processed, memories });
}

// Vercel Cron calls via GET.
export const GET = POST;
