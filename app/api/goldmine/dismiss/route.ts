// Phase 131 — POST: dismiss a Goldmine opportunity for 90 days.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getGoldmineAccess } from '@/lib/goldmine/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const sb = createAdminClient();
  const acc = await getGoldmineAccess(sb);
  if (!acc.ok) return NextResponse.json({ error: acc.error }, { status: acc.status });
  if (acc.locked) return NextResponse.json({ error: 'Upgrade required' }, { status: 403 });

  const { opportunityId } = (await req.json().catch(() => ({}))) as { opportunityId?: string };
  if (!opportunityId) return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });

  const until = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);
  const { error } = await sb
    .from('goldmine_opportunities')
    .update({ status: 'dismissed', dismissed_until: until, last_updated: new Date().toISOString() })
    .eq('id', opportunityId)
    .eq('lo_id', acc.loId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, dismissed_until: until });
}
