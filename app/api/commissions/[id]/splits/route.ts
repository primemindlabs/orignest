import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeSplits, type CommissionSplit } from '@/lib/commissions/engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['admin', 'branch_manager']);
const VALID_ROLES = new Set(['originator', 'co_originator', 'team_lead', 'assistant']);

/** GET /api/commissions/[id]/splits — list splits for a commission. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('commission_splits')
    .select('*, profiles(first_name, last_name)')
    .eq('org_id', orgId)
    .eq('commission_id', params.id)
    .order('split_pct', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ splits: data ?? [] });
}

/**
 * PUT /api/commissions/[id]/splits — replace the split set for a commission.
 * Validates the percentages sum to ≤ 100, computes each dollar amount from the
 * commission's gross compensation, and rewrites the rows transactionally-ish
 * (delete + insert). Admin/manager only.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Only admins can edit splits' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rawSplits: unknown = body?.splits;
  if (!Array.isArray(rawSplits)) {
    return NextResponse.json({ error: 'splits must be an array' }, { status: 400 });
  }

  const splits: CommissionSplit[] = [];
  for (const s of rawSplits) {
    const pct = Number((s as { split_pct?: unknown }).split_pct);
    const profileId = (s as { profile_id?: unknown }).profile_id;
    const splitRole = (s as { role?: unknown }).role;
    if (typeof profileId !== 'string' || !profileId) {
      return NextResponse.json({ error: 'each split needs a profile_id' }, { status: 400 });
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'split_pct must be between 0 and 100' }, { status: 400 });
    }
    if (typeof splitRole !== 'string' || !VALID_ROLES.has(splitRole)) {
      return NextResponse.json({ error: 'invalid split role' }, { status: 400 });
    }
    splits.push({ profile_id: profileId, role: splitRole as CommissionSplit['role'], split_pct: pct });
  }

  const sb = createAdminClient();
  const { data: commission } = await sb
    .from('commissions')
    .select('id, compensation_amount')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!commission) return NextResponse.json({ error: 'Commission not found' }, { status: 404 });

  const gross = Number(commission.compensation_amount) || 0;
  const { allocations, totalPct, remainder } = computeSplits(gross, splits);
  if (totalPct > 100) {
    return NextResponse.json({ error: `Splits total ${totalPct}% — cannot exceed 100%` }, { status: 400 });
  }

  // Replace the split set.
  await sb.from('commission_splits').delete().eq('commission_id', params.id).eq('org_id', orgId);

  if (allocations.length > 0) {
    const rows = allocations.map((a) => ({
      org_id: orgId,
      commission_id: params.id,
      profile_id: a.profile_id,
      role: a.role,
      split_pct: a.split_pct,
      split_amount: a.split_amount,
    }));
    const { error: insErr } = await sb.from('commission_splits').insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, totalPct, remainder, allocations });
}
