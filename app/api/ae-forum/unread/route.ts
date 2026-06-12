import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';
import { buildForumFeed } from '@/lib/aeForum/feed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — unread forum post count for the tab badge.
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId || !orgId) return NextResponse.json({ unread: 0 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ unread: 0 });

  const posts = await buildForumFeed(sb, orgId, me);
  return NextResponse.json({ unread: posts.filter((p) => p.unread).length });
}
