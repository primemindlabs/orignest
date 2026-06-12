// Phase 102 — approve a queued item. SMS requires { tcpa_acknowledged: true } in the
// body (per-item, never bulk). Email approves without a TCPA step.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const sb = createAdminClient();

  const { data: item } = await sb
    .from('outreach_queue')
    .select('id, channel, status')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (item.status !== 'queued') {
    return NextResponse.json({ error: 'Only queued items can be approved' }, { status: 400 });
  }

  const isSms = item.channel === 'sms';
  if (isSms && body?.tcpa_acknowledged !== true) {
    return NextResponse.json({ error: 'TCPA_NOT_ACKNOWLEDGED' }, { status: 400 });
  }

  const { data: updated, error } = await sb
    .from('outreach_queue')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      tcpa_acknowledged: isSms ? true : false,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id, status, tcpa_acknowledged, approved_at')
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Approve failed' }, { status: 500 });
  return NextResponse.json(updated);
}
