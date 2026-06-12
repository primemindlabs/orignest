import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Inbound AE reply webhook (GATED). When an AE replies to a forum notification email,
 * an inbound-email provider POSTs here with the parsed message. We read the
 * X-Forum-Post-Id / X-Ae-Id we set on the outbound email and append the reply as a
 * response. Inert until AE_FORUM_INBOUND_SECRET is configured (and matched), so it can
 * never be spoofed; the LIVE capture path meanwhile is the manual "Add AE response"
 * form. Never fabricates data.
 */
export async function POST(req: Request) {
  const secret = process.env.AE_FORUM_INBOUND_SECRET;
  if (!secret) return NextResponse.json({ error: 'inbound email not configured' }, { status: 501 });
  if (req.headers.get('x-inbound-secret') !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const postId = typeof b.post_id === 'string' ? b.post_id : (req.headers.get('x-forum-post-id') ?? '');
  const aeId = typeof b.ae_id === 'string' ? b.ae_id : (req.headers.get('x-ae-id') ?? null);
  const body = String(b.body ?? '').trim();
  if (!postId || !body) return NextResponse.json({ error: 'post_id and body required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: post } = await sb.from('ae_forum_posts').select('id, org_id, posted_by, title').eq('id', postId).maybeSingle();
  if (!post) return NextResponse.json({ error: 'unknown post' }, { status: 404 });

  let aeName = typeof b.ae_name === 'string' ? b.ae_name : null;
  if (aeId && !aeName) {
    const { data: ae } = await sb.from('lender_ae_connections').select('ae_name').eq('id', aeId).maybeSingle();
    aeName = (ae?.ae_name as string | undefined) ?? null;
  }

  await sb.from('ae_forum_responses').insert({
    post_id: postId,
    org_id: post.org_id,
    lender_ae_id: aeId,
    ae_name: aeName,
    body,
    source: 'email',
    email_message_id: typeof b.message_id === 'string' ? b.message_id : null,
  });

  await notify(sb, {
    orgId: post.org_id as string,
    userId: post.posted_by as string,
    type: 'ae_forum',
    title: `${aeName ?? 'An AE'} replied to your question`,
    body: post.title as string,
    link: `/ae-connect/forum?post=${postId}`,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
