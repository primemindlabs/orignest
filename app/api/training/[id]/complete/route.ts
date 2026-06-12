import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// POST — mark a training item complete for the current user (idempotent) + log a view.
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: item } = await sb.from('training_items').select('id').eq('id', id).eq('org_id', orgId).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Idempotent insert (ON CONFLICT DO NOTHING — keeps the table strictly INSERT-only).
  await sb.from('training_item_completions').upsert(
    { org_id: orgId, training_item_id: id, user_id: me },
    { onConflict: 'training_item_id,user_id', ignoreDuplicates: true },
  );
  await sb.from('training_item_views').insert({ org_id: orgId, training_item_id: id, user_id: me });

  return NextResponse.json({ ok: true });
}
