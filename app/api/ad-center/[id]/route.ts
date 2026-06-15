/**
 * Phase 33.1 — single ad creative: PATCH to archive/unarchive.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { is_archived?: boolean };
  if (typeof body.is_archived !== 'boolean') {
    return NextResponse.json({ error: 'is_archived (boolean) required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { error } = await sb
    .from('ad_creatives')
    .update({ is_archived: body.is_archived })
    .eq('id', params.id)
    .eq('org_id', orgId);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
