/**
 * Phase 95 — nightly realtor heat-score recalculation (cron-callable).
 * Registered via pg_cron + pg_net to POST here daily at 7 AM with
 * Authorization: Bearer <CRON_SECRET> (see migration sidecar SQL). Recomputes
 * every non-archived realtor across all orgs so the hub is current each morning.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recalcRealtorHeatScore, type RealtorForHeat } from '@/lib/realtors/heatScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: realtors } = await sb
    .from('realtors')
    .select('id, org_id, last_contact_at')
    .eq('is_archived', false)
    .limit(10000);

  let succeeded = 0;
  let failed = 0;
  // Process in modest batches to stay within the function time budget.
  const list = (realtors ?? []) as RealtorForHeat[];
  const BATCH = 25;
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map((r) => recalcRealtorHeatScore(sb, r)));
    succeeded += results.filter((r) => r.status === 'fulfilled').length;
    failed += results.filter((r) => r.status === 'rejected').length;
  }

  return NextResponse.json({ ok: true, succeeded, failed, total: list.length });
}

// Vercel Cron invokes via GET with the CRON_SECRET bearer; delegate to POST.
export const GET = POST;
