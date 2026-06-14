// Phase 128 — nightly/morning Autopilot queue generation for every Pro+ LO.
// Mirrors the other /api/cron/* routes (Bearer CRON_SECRET, iterate orgs).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature } from '@/lib/billing/features';
import { generateDailyQueue } from '@/lib/autopilot/generateDailyQueue';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const today = new Date();
  const { data: orgs } = await sb.from('organizations').select('id, name').limit(10000);

  let los = 0;
  let generated = 0;
  for (const org of (orgs ?? []) as { id: string; name: string | null }[]) {
    try {
      const tier = await resolveOrgTier(org.id);
      if (!hasFeature(tier, 'ashley_autopilot')) continue;

      const { data: profiles } = await sb
        .from('profiles')
        .select('id, first_name, last_name, nmls_id')
        .eq('org_id', org.id);

      for (const p of (profiles ?? []) as { id: string; first_name: string | null; last_name: string | null; nmls_id: string | null }[]) {
        los++;
        try {
          const actions = await generateDailyQueue(
            sb,
            p.id,
            org.id,
            { loId: p.id, firstName: p.first_name, lastName: p.last_name, nmls: p.nmls_id, company: org.name },
            today,
          );
          generated += actions.length;
        } catch (e) {
          console.error('[cron/generate-autopilot-queue] lo', p.id, e);
        }
      }
    } catch (e) {
      console.error('[cron/generate-autopilot-queue] org', org.id, e);
    }
  }

  return NextResponse.json({ orgs: orgs?.length ?? 0, los, generated });
}

export const GET = POST;
