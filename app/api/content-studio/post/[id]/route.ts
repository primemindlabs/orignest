// Phase 132 — PATCH: edit / approve / skip / mark-published a single post.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { resolveLoProfile } from '@/lib/autopilot/loContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const profile = await resolveLoProfile(sb, userId);
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { action, edited_text } = (await req.json().catch(() => ({}))) as { action?: string; edited_text?: string };

  const patch: Record<string, unknown> = {};
  switch (action) {
    case 'edit':
      patch.edited_text = edited_text ?? '';
      patch.status = 'edited';
      break;
    case 'approve':
      patch.lo_approved = true;
      patch.status = 'approved';
      break;
    case 'skip':
      patch.status = 'skipped';
      break;
    case 'publish':
      patch.status = 'published';
      patch.published_at = new Date().toISOString();
      break;
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('content_posts')
    .update(patch)
    .eq('id', params.id)
    .eq('lo_id', profile.id)
    .select()
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  return NextResponse.json({ ok: true, post: data });
}
