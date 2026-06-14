// Phase 131 — GET ranked Goldmine opportunities (lazy-scans on first visit).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGoldmineAccess } from '@/lib/goldmine/access';
import { scanGoldmineForLO } from '@/lib/goldmine/scanGoldmine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const sb = createAdminClient();
  const acc = await getGoldmineAccess(sb);
  if (!acc.ok) return NextResponse.json({ error: acc.error }, { status: acc.status });
  if (acc.locked) return NextResponse.json({ locked: true, tier: acc.tier, opportunities: [] });

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'surfaced';
  const signal = url.searchParams.get('signal'); // optional signal_type filter

  // Lazy first scan: if the LO has no opportunities at all yet, run one now.
  const { count } = await sb
    .from('goldmine_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('lo_id', acc.loId);
  if (!count) {
    try {
      await scanGoldmineForLO(sb, acc.loId, acc.orgId, acc.loFirstName, acc.compRate);
    } catch (e) {
      console.error('[goldmine/opportunities] lazy scan failed', e);
    }
  }

  let q = sb
    .from('goldmine_opportunities')
    .select('*')
    .eq('lo_id', acc.loId)
    .eq('status', status)
    .order('priority_score', { ascending: false })
    .limit(200);
  if (signal) q = q.eq('signal_type', signal);

  const { data } = await q;
  return NextResponse.json({ locked: false, tier: acc.tier, opportunities: data ?? [] });
}
