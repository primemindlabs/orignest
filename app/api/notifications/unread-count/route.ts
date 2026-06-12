// Phase 87 — unread count from the notifications event store (for the bell badge fallback).

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ count: 0 });
    const sb = createAdminClient();
    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    if (!profile?.id) return NextResponse.json({ count: 0 });

    const { count } = await sb
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);

    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    console.error('[notifications unread-count]', err);
    return NextResponse.json({ count: 0 });
  }
}
