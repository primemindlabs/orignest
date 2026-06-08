import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['admin', 'branch_manager']);

/**
 * POST /api/commissions/[id]/clawback — reverse a paid commission.
 * Writes an append-only `clawback_events` audit row (INSERT-only RLS) and flips
 * the commission status to 'clawed_back'. Admin/manager only.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Only admins can record clawbacks' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason) return NextResponse.json({ error: 'A reason is required for a clawback' }, { status: 400 });

  const sb = createAdminClient();

  const { data: commission } = await sb
    .from('commissions')
    .select('id, lo_id, compensation_amount, status')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!commission) return NextResponse.json({ error: 'Commission not found' }, { status: 404 });
  if (commission.status === 'clawed_back') {
    return NextResponse.json({ error: 'Commission is already clawed back' }, { status: 409 });
  }

  const amount =
    body?.clawback_amount != null && Number.isFinite(Number(body.clawback_amount))
      ? Number(body.clawback_amount)
      : Number(commission.compensation_amount);

  // Append-only audit record FIRST (the source of truth for the reversal).
  const { error: auditErr } = await sb.from('clawback_events').insert({
    org_id: orgId,
    commission_id: commission.id,
    lo_id: commission.lo_id,
    clawback_amount: amount,
    reason,
    created_by: userId,
  });
  if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 500 });

  const { error: updErr } = await sb
    .from('commissions')
    .update({ status: 'clawed_back', updated_at: new Date().toISOString() })
    .eq('id', commission.id)
    .eq('org_id', orgId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, clawback_amount: amount });
}
