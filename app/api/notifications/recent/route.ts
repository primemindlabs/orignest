// Phase 87 — recent notifications for the current user (authed, admin client so it works
// under Clerk auth where the browser Supabase client can't pass RLS). Powers the toast
// poll fallback since Realtime delivery needs a Clerk↔Supabase JWT that isn't wired yet.

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ notifications: [] });
    const sb = createAdminClient();
    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    if (!profile?.id) return NextResponse.json({ notifications: [] });

    const { data } = await sb
      .from('notifications')
      .select('id, title, body, link, created_at')
      .eq('user_id', profile.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({ notifications: data ?? [] });
  } catch (err) {
    console.error('[notifications recent]', err);
    return NextResponse.json({ notifications: [] });
  }
}
