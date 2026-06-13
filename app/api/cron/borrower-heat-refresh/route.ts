// Phase 110 — daily borrower heat recompute. pg_cron (Bearer CRON_SECRET), mirroring
// the other /api/cron/* routes and the Phase 95 realtor-heat cron.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recalcBorrowerHeatForOrg } from '@/lib/borrowerHeat/heatScore';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: orgs } = await sb.from('organizations').select('id').limit(10000);

  let snapshotted = 0;
  for (const org of orgs ?? []) {
    try {
      snapshotted += await recalcBorrowerHeatForOrg(sb, org.id as string);
    } catch (e) {
      console.error('[cron/borrower-heat-refresh]', org.id, e);
    }
  }

  return NextResponse.json({ orgs: orgs?.length ?? 0, snapshotted });
}
