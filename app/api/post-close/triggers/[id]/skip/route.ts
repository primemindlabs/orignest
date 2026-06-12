// Phase 103 — skip a queued post-close draft (status -> skipped). History preserved.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: trigger } = await sb
    .from('post_close_outreach')
    .select('id, status')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!trigger) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (trigger.status !== 'queued') return NextResponse.json({ error: 'Already actioned' }, { status: 400 });

  const { error } = await sb
    .from('post_close_outreach')
    .update({ status: 'skipped', skipped_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) return NextResponse.json({ error: 'Skip failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
