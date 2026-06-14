// Phase 130 — daily Business Pulse generation for every Team-tier org.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature } from '@/lib/billing/features';
import { ensureTodaysPulse } from '@/lib/businessPulse/computePulseScore';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: orgs } = await sb.from('organizations').select('id').limit(10000);

  let computed = 0;
  for (const org of (orgs ?? []) as { id: string }[]) {
    try {
      const tier = await resolveOrgTier(org.id);
      if (!hasFeature(tier, 'business_pulse')) continue;

      // Attribute the score to a branch manager / admin (branch_manager_id is NOT NULL).
      const { data: bm } = await sb
        .from('profiles')
        .select('id')
        .eq('org_id', org.id)
        .in('role', ['branch_manager', 'admin'])
        .limit(1)
        .maybeSingle();
      if (!bm) continue;

      await ensureTodaysPulse(sb, org.id, bm.id as string);
      computed++;
    } catch (e) {
      console.error('[cron/business-pulse]', org.id, e);
    }
  }

  return NextResponse.json({ orgs: orgs?.length ?? 0, computed });
}

export const GET = POST;
