// Phase 131 — weekly Goldmine scan for every Pro+ LO (Sunday).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature } from '@/lib/billing/features';
import { scanGoldmineForLO } from '@/lib/goldmine/scanGoldmine';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: orgs } = await sb.from('organizations').select('id').limit(10000);

  let los = 0;
  let surfaced = 0;
  for (const org of (orgs ?? []) as { id: string }[]) {
    try {
      const tier = await resolveOrgTier(org.id);
      if (!hasFeature(tier, 'database_goldmine')) continue;
      const { data: profiles } = await sb.from('profiles').select('id, first_name, comp_rate').eq('org_id', org.id);
      for (const p of (profiles ?? []) as { id: string; first_name: string | null; comp_rate: number | null }[]) {
        los++;
        try {
          surfaced += await scanGoldmineForLO(sb, p.id, org.id, p.first_name ?? '', p.comp_rate);
        } catch (e) {
          console.error('[cron/goldmine-scan] lo', p.id, e);
        }
      }
    } catch (e) {
      console.error('[cron/goldmine-scan] org', org.id, e);
    }
  }

  return NextResponse.json({ orgs: orgs?.length ?? 0, los, surfaced });
}

export const GET = POST;
