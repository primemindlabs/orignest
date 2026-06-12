import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLAN_SELECT = 'lo_id, comp_type, bps_rate, flat_fee_amount, branch_split_pct, processor_fee, updated_at';

// GET — the LO's saved take-home comp plan; seeds bps_rate from profiles.comp_rate when
// no plan has been saved yet.
export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id, comp_rate').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: plan } = await sb.from('lo_comp_plans').select(PLAN_SELECT).eq('lo_id', profile.id).maybeSingle();
  if (plan) return NextResponse.json({ plan, seeded: false });

  // Default plan seeded from the personal comp_rate (% → bps).
  const seededBps = profile.comp_rate != null ? Math.round(Number(profile.comp_rate) * 100) : 100;
  return NextResponse.json({
    plan: { lo_id: profile.id, comp_type: 'bps', bps_rate: seededBps, flat_fee_amount: null, branch_split_pct: 0, processor_fee: 0, updated_at: null },
    seeded: true,
  });
}

// POST — upsert the LO's take-home comp plan.
export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const compType = b.comp_type === 'flat_fee' ? 'flat_fee' : 'bps';
  const num = (v: unknown): number | null => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

  const { data: plan, error } = await sb
    .from('lo_comp_plans')
    .upsert(
      {
        lo_id: profile.id,
        org_id: orgId,
        comp_type: compType,
        bps_rate: num(b.bps_rate),
        flat_fee_amount: num(b.flat_fee_amount),
        branch_split_pct: num(b.branch_split_pct) ?? 0,
        processor_fee: num(b.processor_fee) ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'lo_id' },
    )
    .select(PLAN_SELECT)
    .single();
  if (error) {
    console.error('[comp/plan POST]', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ plan });
}
