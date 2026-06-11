// Phase 81 — GET { count } of undismissed URGENT items in today's brief (for the nav badge).
// Read-only: never generates, so polling stays cheap.

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import type { BriefItem } from '@/lib/morning-brief/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ count: 0 });

    const sb = createAdminClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    const loId = profile?.id as string | undefined;
    if (!loId) return NextResponse.json({ count: 0 });

    const today = new Date().toISOString().slice(0, 10);
    const { data: brief } = await sb
      .from('morning_briefs')
      .select('brief_data, dismissed_items')
      .eq('org_id', orgId)
      .eq('lo_id', loId)
      .eq('brief_date', today)
      .maybeSingle();

    if (!brief) return NextResponse.json({ count: 0 });

    const dismissed = new Set((brief.dismissed_items as string[]) ?? []);
    const count = ((brief.brief_data as BriefItem[]) ?? []).filter(
      (i) => i.category === 'urgent' && !dismissed.has(i.id),
    ).length;

    return NextResponse.json({ count });
  } catch (err) {
    console.error('[morning-brief unread-count]', err);
    return NextResponse.json({ count: 0 });
  }
}
