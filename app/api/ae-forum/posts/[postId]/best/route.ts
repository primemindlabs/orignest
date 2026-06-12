import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ postId: string }> };

// POST — the post author marks one response as the best answer (and resolves the post).
export async function POST(req: Request, { params }: Ctx) {
  const { postId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const responseId = typeof b.response_id === 'string' ? b.response_id : null;

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: post } = await sb.from('ae_forum_posts').select('id, posted_by').eq('id', postId).eq('org_id', orgId).maybeSingle();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (post.posted_by !== me) return NextResponse.json({ error: 'Only the author can mark the best answer' }, { status: 403 });

  // Validate the response belongs to this post (when setting, not clearing).
  if (responseId) {
    const { data: resp } = await sb.from('ae_forum_responses').select('id').eq('id', responseId).eq('post_id', postId).maybeSingle();
    if (!resp) return NextResponse.json({ error: 'Response not found' }, { status: 404 });
  }

  await sb.from('ae_forum_posts').update({ best_response_id: responseId, is_resolved: !!responseId }).eq('id', postId);
  return NextResponse.json({ ok: true });
}
