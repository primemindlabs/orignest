import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUSES = new Set(['invited', 'contacted', 'application', 'closed', 'declined']);
const REWARD_STATUSES = new Set(['pending', 'earned', 'paid', 'void']);

/** PATCH /api/buyer-referrals/[id] — update status / reward of a referral. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = await req.json().catch(() => null);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.status != null) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    patch.status = body.status;
  }
  if (body?.reward_status != null) {
    if (!REWARD_STATUSES.has(body.reward_status)) return NextResponse.json({ error: 'Invalid reward status' }, { status: 400 });
    patch.reward_status = body.reward_status;
  }
  if (body?.reward_amount != null && Number.isFinite(Number(body.reward_amount))) {
    patch.reward_amount = Number(body.reward_amount);
  }
  if (body?.converted_lead_id !== undefined) patch.converted_lead_id = body.converted_lead_id || null;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('buyer_referrals')
    .update(patch)
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
  return NextResponse.json({ referral: data });
}
