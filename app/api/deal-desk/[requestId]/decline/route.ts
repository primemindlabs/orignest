// Phase 120 — LO declines / closes a deal-desk request.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { requestId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const reason = b.reason ? b.reason.toString().slice(0, 500) : null;

  const sb = createAdminClient();
  const { data: req } = await sb
    .from('ae_deal_desk_requests')
    .select('id, status')
    .eq('id', params.requestId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (['approved', 'declined'].includes(req.status as string)) {
    return NextResponse.json({ error: `Already ${req.status}.` }, { status: 409 });
  }

  const now = new Date().toISOString();
  await sb
    .from('ae_deal_desk_requests')
    .update({ status: 'declined', updated_at: now })
    .eq('id', params.requestId)
    .eq('org_id', orgId);

  await sb.from('ae_deal_desk_messages').insert({
    request_id: params.requestId,
    org_id: orgId,
    sender_type: 'system',
    body: reason ? `Request declined: ${reason}` : 'Request declined.',
  });

  return NextResponse.json({ ok: true });
}
