import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

// GET — short-lived signed URL for an uploaded item (1hr), and log the view.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: item } = await sb
    .from('training_items')
    .select('id, storage_path, external_url, content_type')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Log the view (best-effort).
  await sb.from('training_item_views').insert({ org_id: orgId, training_item_id: id, user_id: me }).then(() => undefined, () => undefined);

  if (item.external_url) return NextResponse.json({ url: item.external_url, kind: 'external', content_type: item.content_type });
  if (!item.storage_path) return NextResponse.json({ error: 'No content' }, { status: 404 });

  const { data: signed } = await sb.storage.from('training-content').createSignedUrl(item.storage_path as string, 3600);
  return NextResponse.json({ url: signed?.signedUrl ?? null, kind: 'file', content_type: item.content_type });
}
