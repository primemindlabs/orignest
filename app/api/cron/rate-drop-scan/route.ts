/**
 * Phase 30.7 — daily rate-drop scan (cron-callable, Bearer CRON_SECRET).
 * Drafts refi outreach for every org that has eligible past borrowers.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runRateDropScan } from '@/lib/ai/runRateDropScan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: orgs } = await sb.from('organizations').select('id');
  let totalCreated = 0;
  for (const o of orgs ?? []) {
    const r = await runRateDropScan(sb, o.id);
    totalCreated += r.created;
  }
  return NextResponse.json({ ok: true, drafts_created: totalCreated });
}
