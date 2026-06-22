/**
 * Arive incremental sync cron. Arive's webhook subscribe is blocked at their edge,
 * so we keep the pipeline fresh by polling the search API for every org with an
 * active Arive connection and staging new records into /inbound. CRON_SECRET bearer.
 * GET and POST both supported (Vercel cron GET vs pg_cron POST).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { pullAriveToInbound } from '@/lib/los/arivePull';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();
  const { data: conns } = await sb.from('los_connections').select('org_id').eq('los_type', 'arive').eq('is_active', true);
  const results: { org_id: string; staged?: number; gated?: string }[] = [];
  for (const c of conns ?? []) {
    try {
      // Incremental: a couple of pages of most-recently-updated records is enough
      // between runs; new ones de-dupe, already-seen ones are skipped.
      const r = await pullAriveToInbound(c.org_id as string, { maxPages: 2 });
      results.push(r.gated ? { org_id: c.org_id as string, gated: r.reason } : { org_id: c.org_id as string, staged: r.staged });
    } catch (e) {
      results.push({ org_id: c.org_id as string, gated: (e as Error).message });
    }
  }
  return NextResponse.json({ ok: true, orgs: results.length, results });
}

export const GET = run;
export const POST = run;
