// Phase 102 — daily outreach generation. Triggered by pg_cron (net.http_post with
// Bearer CRON_SECRET), mirroring the other /api/cron/* routes. For every org it
// (1) syncs life_events from leads/realtors, then (2) hydrates the review queue for
// events landing in the next 7 days. Idempotent end-to-end.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { syncLifeEventsForOrg } from '@/lib/outreach/eventSync';
import { generateOutreachQueueForOrg } from '@/lib/outreach/queueGenerator';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: orgs } = await sb.from('organizations').select('id').limit(10000);

  let synced = 0;
  let created = 0;
  let skipped = 0;
  for (const org of orgs ?? []) {
    const orgId = org.id as string;
    try {
      synced += await syncLifeEventsForOrg(sb, orgId);
      const r = await generateOutreachQueueForOrg(sb, orgId);
      created += r.created;
      skipped += r.skipped;
    } catch (e) {
      console.error('[cron/outreach-queue]', orgId, e);
    }
  }

  return NextResponse.json({ orgs: orgs?.length ?? 0, synced, created, skipped });
}

// Vercel Cron invokes via GET with the CRON_SECRET bearer; delegate to POST.
export const GET = POST;
