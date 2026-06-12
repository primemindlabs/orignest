import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST — toggle the current user's star on a response (org-scoped).
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const responseId = typeof b.response_id === 'string' ? b.response_id : '';
  if (!responseId) return NextResponse.json({ error: 'response_id required' }, { status: 400 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // Confirm the response is in this org before starring.
  const { data: resp } = await sb.from('ae_forum_responses').select('id').eq('id', responseId).eq('org_id', orgId).maybeSingle();
  if (!resp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: existing } = await sb.from('ae_forum_stars').select('response_id').eq('response_id', responseId).eq('user_id', me).maybeSingle();
  if (existing) {
    await sb.from('ae_forum_stars').delete().eq('response_id', responseId).eq('user_id', me);
    return NextResponse.json({ starred: false });
  }
  await sb.from('ae_forum_stars').insert({ response_id: responseId, user_id: me });
  return NextResponse.json({ starred: true });
}
