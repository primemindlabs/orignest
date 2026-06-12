// Phase 102 — skip a queued/approved item (status -> skipped). History preserved.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: item } = await sb
    .from('outreach_queue')
    .select('id, status')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!['queued', 'approved'].includes(item.status as string)) {
    return NextResponse.json({ error: 'Cannot skip this item' }, { status: 400 });
  }

  const { error } = await sb
    .from('outreach_queue')
    .update({ status: 'skipped' })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) return NextResponse.json({ error: 'Skip failed' }, { status: 500 });
  return NextResponse.json({ id, status: 'skipped' });
}
