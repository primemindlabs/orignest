import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = new Set(['admin', 'branch_manager']);

/** GET /api/commissions/plans — list comp plans for the org. */
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('comp_plans')
    .select('*, profiles(first_name, last_name)')
    .eq('org_id', orgId)
    .order('is_active', { ascending: false })
    .order('effective_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plans: data ?? [] });
}

/**
 * POST /api/commissions/plans — create a comp plan (admin only).
 * Reg Z 1026.36(d)(1): comp is keyed on loan amount only. We accept a `basis`
 * of 'bps' or 'flat' and the matching figure; anything else is rejected before
 * it can reach the DB (which also enforces this with a CHECK constraint).
 */
export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Only admins can manage comp plans' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const basis = body.basis;
  if (basis !== 'bps' && basis !== 'flat') {
    return NextResponse.json({ error: "basis must be 'bps' or 'flat'" }, { status: 400 });
  }

  const compBps = basis === 'bps' ? Number(body.comp_bps) : null;
  const compFlat = basis === 'flat' ? Number(body.comp_flat) : null;
  if (basis === 'bps' && (!Number.isFinite(compBps as number) || (compBps as number) < 0)) {
    return NextResponse.json({ error: 'comp_bps must be a non-negative number' }, { status: 400 });
  }
  if (basis === 'flat' && (!Number.isFinite(compFlat as number) || (compFlat as number) < 0)) {
    return NextResponse.json({ error: 'comp_flat must be a non-negative number' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('comp_plans')
    .insert({
      org_id: orgId,
      lo_id: body.lo_id || null,
      name: body.name.trim(),
      basis,
      comp_bps: compBps,
      comp_flat: compFlat,
      min_loan_amount: Number.isFinite(Number(body.min_loan_amount)) ? Number(body.min_loan_amount) : 0,
      max_loan_amount: body.max_loan_amount != null ? Number(body.max_loan_amount) : null,
      max_comp_amount: body.max_comp_amount != null ? Number(body.max_comp_amount) : null,
      effective_date: body.effective_date || new Date().toISOString().slice(0, 10),
      is_active: body.is_active !== false,
      notes: body.notes || null,
    })
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data }, { status: 201 });
}
