import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';
import { notify } from '@/lib/notifications/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ postId: string }> };

// POST — manually key an AE's response (the LIVE path; inbound email is the gated path).
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

  // Resolve AE name for the snapshot (if an AE from the directory was selected).
  let aeName = typeof b.ae_name === 'string' ? b.ae_name : null;
  const lenderAeId = typeof b.lender_ae_id === 'string' ? b.lender_ae_id : null;
  if (lenderAeId && !aeName) {
    const { data: ae } = await sb.from('lender_ae_connections').select('ae_name').eq('id', lenderAeId).maybeSingle();
    aeName = (ae?.ae_name as string | undefined) ?? null;
  }

  const { data: response, error } = await sb
    .from('ae_forum_responses')
    .insert({ post_id: postId, org_id: orgId, lender_ae_id: lenderAeId, ae_name: aeName, body, source: 'manual', added_by: me })
    .select('id, body, source, created_at, lender_ae_id, ae_name')
    .single();
  if (error || !response) {
    console.error('[ae-forum response POST]', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  // Notify the post author (unless they keyed it themselves).
  if (post.posted_by !== me) {
    await notify(sb, {
      orgId,
      userId: post.posted_by as string,
      type: 'ae_forum',
      title: `${aeName ?? 'An AE'} responded to your question`,
      body: post.title as string,
      link: `/ae-connect/forum?post=${postId}`,
    });
  }

  return NextResponse.json({ response }, { status: 201 });
}
