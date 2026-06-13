// Phase 103 — nightly post-close trigger detection (rate-drop + equity-gain drafts).
// Triggered by pg_cron (Bearer CRON_SECRET), mirroring the other /api/cron/* routes.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { detectPostCloseTriggers } from '@/lib/post-close/detectTriggers';

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const { data: orgs } = await sb.from('organizations').select('id').limit(10000);

  let created = 0;
  let eligible = 0;
  for (const org of orgs ?? []) {
    try {
      const r = await detectPostCloseTriggers(sb, org.id as string);
      created += r.created;
      eligible += r.eligible;
    } catch (e) {
      console.error('[cron/post-close]', org.id, e);
    }
  }

  return NextResponse.json({ orgs: orgs?.length ?? 0, created, eligible });
}

// Vercel Cron invokes via GET with the CRON_SECRET bearer; delegate to POST.
export const GET = POST;
