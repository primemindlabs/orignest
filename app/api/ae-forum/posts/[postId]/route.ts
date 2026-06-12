import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ postId: string }> };

interface RespRow {
  id: string;
  body: string;
  source: string;
  created_at: string;
  lender_ae_id: string | null;
  ae_name: string | null;
  lender_ae: { id: string; ae_name: string | null; lender_name: string | null; ae_title: string | null } | null;
}

// GET — full thread: post, responses (with AE + stars), comments, branch size. Marks read.
export async function GET(_req: Request, { params }: Ctx) {
  const { postId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: post } = await sb
    .from('ae_forum_posts')
    .select('id, posted_by, category, title, body, notified_ae_ids, is_resolved, best_response_id, created_at')
    .eq('id', postId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: rawResponses } = await sb
    .from('ae_forum_responses')
    .select('id, body, source, created_at, lender_ae_id, ae_name, lender_ae:lender_ae_connections!ae_forum_responses_lender_ae_id_fkey(id, ae_name, lender_name, ae_title)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  const responses = (rawResponses ?? []) as unknown as RespRow[];

  // Star aggregation.
  const respIds = responses.map((r) => r.id);
  const starCount: Record<string, number> = {};
  const starMine: Record<string, boolean> = {};
  if (respIds.length > 0) {
    const { data: stars } = await sb.from('ae_forum_stars').select('response_id, user_id').in('response_id', respIds);
    for (const s of stars ?? []) {
      const rid = s.response_id as string;
      starCount[rid] = (starCount[rid] ?? 0) + 1;
      if (s.user_id === me) starMine[rid] = true;
    }
  }
  const responsesOut = responses.map((r) => ({
    ...r,
    star_count: starCount[r.id] ?? 0,
    user_starred: starMine[r.id] ?? false,
  }));

  // Comments + poster + branch size.
  const [{ data: comments }, { data: poster }, { count: branchCount }] = await Promise.all([
    sb.from('ae_forum_comments').select('id, body, created_at, author:profiles!ae_forum_comments_author_id_fkey(first_name, last_name)').eq('post_id', postId).order('created_at', { ascending: true }),
    sb.from('profiles').select('id, first_name, last_name').eq('id', post.posted_by).maybeSingle(),
    sb.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('active', true),
  ]);

  await sb.from('ae_forum_reads').upsert({ user_id: me, post_id: postId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,post_id' });

  return NextResponse.json({
    post: { ...post, poster_name: poster ? `${poster.first_name ?? ''} ${poster.last_name ?? ''}`.trim() || 'Teammate' : 'Teammate' },
    responses: responsesOut,
    comments: comments ?? [],
    branch_member_count: branchCount ?? 0,
    is_author: post.posted_by === me,
    me,
  });
}
