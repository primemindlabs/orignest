// Phase 81 — POST { item_id } to dismiss a brief item for today (append, de-duplicated).

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { item_id?: string };
    const itemId = body.item_id?.trim();
    if (!itemId) return NextResponse.json({ error: 'item_id required' }, { status: 400 });

    const sb = createAdminClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    const loId = profile?.id as string | undefined;
    if (!loId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const today = new Date().toISOString().slice(0, 10);
    const { data: brief } = await sb
      .from('morning_briefs')
      .select('id, dismissed_items')
      .eq('org_id', orgId)
      .eq('lo_id', loId)
      .eq('brief_date', today)
      .maybeSingle();

    if (!brief) return NextResponse.json({ error: 'No brief for today' }, { status: 404 });

    const next = Array.from(new Set([...((brief.dismissed_items as string[]) ?? []), itemId]));
    await sb.from('morning_briefs').update({ dismissed_items: next }).eq('id', brief.id);

    return NextResponse.json({ dismissed_items: next });
  } catch (err) {
    console.error('[morning-brief dismiss]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
