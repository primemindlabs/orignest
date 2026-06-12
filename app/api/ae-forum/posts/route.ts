import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';
import { buildForumFeed } from '@/lib/aeForum/feed';
import { CATEGORY_KEYS } from '@/lib/aeForum/categories';
import { sendCompliantEmail } from '@/lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — the org's forum feed (questions + response counts + unread flags).
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const posts = await buildForumFeed(sb, orgId, me);
  return NextResponse.json({ posts, me });
}

// POST — post a question and email the selected AEs (from the poster's own directory).
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = String(b.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const category = CATEGORY_KEYS.includes(b.category as never) ? (b.category as string) : 'general';
  const body = b.body ? String(b.body) : null;
  const requestedAeIds = Array.isArray(b.notified_ae_ids) ? b.notified_ae_ids.filter((x) => typeof x === 'string') : [];

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Only notify AEs in the poster's own directory.
  const { data: aes } = requestedAeIds.length
    ? await sb.from('lender_ae_connections').select('id, ae_name, ae_email').eq('lo_id', me).eq('is_active', true).in('id', requestedAeIds)
    : { data: [] as { id: string; ae_name: string; ae_email: string }[] };
  const notifiedIds = (aes ?? []).map((a) => a.id);

  const { data: post, error } = await sb
    .from('ae_forum_posts')
    .insert({ org_id: orgId, posted_by: me, category, title, body, notified_ae_ids: notifiedIds })
    .select('id, category, title, body, notified_ae_ids, created_at')
    .single();
  if (error || !post) {
    console.error('[ae-forum/posts POST]', error);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }

  // Poster has implicitly "read" their own post.
  await sb.from('ae_forum_reads').upsert({ user_id: me, post_id: post.id, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,post_id' });

  // Email notified AEs (gated on RESEND_API_KEY — record-only without it).
  let emailed = 0;
  if (process.env.RESEND_API_KEY && (aes ?? []).length > 0) {
    const { data: poster } = await sb.from('profiles').select('first_name, last_name, email').eq('id', me).maybeSingle();
    const posterName = poster ? `${poster.first_name ?? ''} ${poster.last_name ?? ''}`.trim() || 'A loan officer' : 'A loan officer';
    for (const ae of aes ?? []) {
      try {
        await sendCompliantEmail({
          replyTo: poster?.email || undefined,
          to: ae.ae_email,
          recipientEmail: ae.ae_email,
          orgId,
          subject: `[AshleyIQ Forum] ${title}`,
          text: `${posterName} posted a question to their branch forum:\n\n"${title}"\n\n${body ?? ''}\n\n---\nReply to this email to share your answer. Your response will be visible to the whole branch team.\n\nPost ID: ${post.id}`,
          headers: { 'X-Forum-Post-Id': String(post.id), 'X-Ae-Id': ae.id },
        });
        emailed += 1;
      } catch (e) {
        console.error('[ae-forum email]', e);
      }
    }
  }

  return NextResponse.json({ post, notified: notifiedIds.length, emailed }, { status: 201 });
}
