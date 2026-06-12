import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';
import { notify } from '@/lib/notifications/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ postId: string }> };

// POST — a branch teammate's follow-up comment on a post (visible to the whole org).
export async function POST(req: Request, { params }: Ctx) {
  const { postId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const body = String(b.body ?? '').trim();
  if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: post } = await sb.from('ae_forum_posts').select('id, posted_by, title').eq('id', postId).eq('org_id', orgId).maybeSingle();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: comment, error } = await sb
    .from('ae_forum_comments')
    .insert({ post_id: postId, org_id: orgId, author_id: me, body })
    .select('id, body, created_at')
    .single();
  if (error || !comment) {
    console.error('[ae-forum comment POST]', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  if (post.posted_by !== me) {
    await notify(sb, {
      orgId,
      userId: post.posted_by as string,
      type: 'ae_forum',
      title: 'New comment on your forum question',
      body: post.title as string,
      link: `/ae-connect/forum?post=${postId}`,
    });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
