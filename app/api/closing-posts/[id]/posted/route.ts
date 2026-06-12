/**
 * Phase 96 — POST /api/closing-posts/[id]/posted
 * Records that the LO shared the approved post to the chosen platforms. Direct
 * social-API publishing is gated in this app (no OAuth), so sharing happens via
 * copy-to-clipboard; this endpoint marks the post 'posted' and logs the audit.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['instagram', 'facebook', 'linkedin'];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { platforms?: string[] };
  const platforms = (body.platforms ?? []).filter((p) => PLATFORMS.includes(p));

  const sb = createAdminClient();
  const { data: post } = await sb
    .from('closing_posts')
    .select('id, lo_id, post_status')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (post.post_status !== 'approved' && post.post_status !== 'posted') {
    return NextResponse.json({ error: 'Post must be approved first' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from('closing_posts')
    .update({ post_status: 'posted', posted_at: now, posted_platforms: platforms })
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });

  await sb.from('closing_post_audit').insert({
    post_id: params.id,
    org_id: orgId,
    lo_id: post.lo_id,
    action: 'posted',
    details: { platforms },
  });

  return NextResponse.json({ post: updated });
}
