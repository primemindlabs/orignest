/**
 * Phase 96 — POST /api/closing-posts/[id]/approve
 * Re-runs the compliance pre-filter server-side on the (possibly edited) copy as
 * a hard gate, then marks the post approved. 422 if the edited copy still trips a
 * flag — the client cannot approve non-compliant copy.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkPostCompliance } from '@/lib/compliance/postCompliance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { edited_copy?: string };
  const sb = createAdminClient();

  const { data: post } = await sb
    .from('closing_posts')
    .select('id, generated_copy, lo_id')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const edited = body.edited_copy?.trim();
  const finalCopy = edited || post.generated_copy;
  const compliance = checkPostCompliance(finalCopy);
  if (!compliance.passed) {
    return NextResponse.json(
      { error: 'Edited copy still has compliance issues', flags: compliance.flags },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from('closing_posts')
    .update({
      post_status: 'approved',
      approved_at: now,
      edited_copy: edited ?? null,
      compliance_check_passed: true,
      compliance_flags: [],
    })
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 });

  if (edited && edited !== post.generated_copy) {
    await sb.from('closing_post_audit').insert({ post_id: params.id, org_id: orgId, lo_id: post.lo_id, action: 'edited' });
  }
  await sb.from('closing_post_audit').insert({ post_id: params.id, org_id: orgId, lo_id: post.lo_id, action: 'approved' });

  return NextResponse.json({ post: updated });
}
