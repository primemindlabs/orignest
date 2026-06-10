/**
 * Phase 67 — branch manager comps (covers) an LO's seat/usage.
 * PATCH { branch_covers_seat, branch_covers_usage } → upsert lo_billing. comping the
 * seat sets status='comped'. Manager/admin only; same-org enforced.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const MGR = ['admin', 'branch_manager', 'manager'];

export async function PATCH(req: Request, { params }: { params: { userId: string } }) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!MGR.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { branch_covers_seat?: boolean; branch_covers_usage?: boolean };

  const sb = createAdminClient();
  // Same-org enforcement: the target LO must belong to this org.
  const { data: target } = await sb.from('profiles').select('id').eq('id', params.userId).eq('org_id', orgId).maybeSingle();
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: existing } = await sb.from('lo_billing').select('id, status').eq('user_id', params.userId).maybeSingle();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.branch_covers_seat === 'boolean') { patch.branch_covers_seat = b.branch_covers_seat; if (b.branch_covers_seat) patch.status = 'comped'; }
  if (typeof b.branch_covers_usage === 'boolean') patch.branch_covers_usage = b.branch_covers_usage;

  if (existing) await sb.from('lo_billing').update(patch).eq('user_id', params.userId);
  else await sb.from('lo_billing').insert({ org_id: orgId, user_id: params.userId, status: b.branch_covers_seat ? 'comped' : 'invited', branch_covers_seat: !!b.branch_covers_seat, branch_covers_usage: !!b.branch_covers_usage });
  return NextResponse.json({ ok: true });
}
