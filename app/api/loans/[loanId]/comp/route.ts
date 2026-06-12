import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeComp, type CompType } from '@/lib/comp/calc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ loanId: string }> };

// GET — the most recent saved comp estimate for this loan (latest snapshot is current).
export async function GET(_req: Request, { params }: Ctx) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: estimate } = await sb
    .from('loan_comp_estimates')
    .select('*')
    .eq('loan_id', loanId)
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ estimate: estimate ?? null });
}

// POST — compute a comp estimate for this loan (plan defaults + per-loan overrides) and
// save it as an INSERT-only snapshot.
export async function POST(req: Request, { params }: Ctx) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: lead } = await sb.from('leads').select('id, loan_amount').eq('id', loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const { data: plan } = await sb.from('lo_comp_plans').select('*').eq('lo_id', profile.id).maybeSingle();

  // Per-loan body overrides win over the saved plan defaults.
  const compType: CompType = (b.comp_type ?? plan?.comp_type) === 'flat_fee' ? 'flat_fee' : 'bps';
  const pick = (a: unknown, fallback: unknown) => (a === undefined || a === null || a === '' ? fallback : a);
  const loanAmount = Number(pick(b.loan_amount, lead.loan_amount)) || 0;

  const result = computeComp({
    loanAmount,
    compType,
    bpsRate: Number(pick(b.bps_rate, plan?.bps_rate ?? 100)),
    flatFee: Number(pick(b.flat_fee_amount, plan?.flat_fee_amount ?? 0)),
    branchSplitPct: Number(pick(b.branch_split_pct, plan?.branch_split_pct ?? 0)),
    processorFee: Number(pick(b.processor_fee, plan?.processor_fee ?? 0)),
  });

  const { data: saved, error } = await sb
    .from('loan_comp_estimates')
    .insert({
      org_id: orgId,
      loan_id: loanId,
      lo_id: profile.id,
      loan_amount: loanAmount,
      bps_rate: compType === 'bps' ? Number(pick(b.bps_rate, plan?.bps_rate ?? 100)) : null,
      gross_comp: result.grossComp,
      branch_split_amount: result.branchSplitAmount,
      processor_fee: result.processorDeduction,
      net_comp: result.netComp,
      comp_type: compType,
      notes: typeof b.notes === 'string' ? b.notes : null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[loan comp POST]', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ result, estimate: saved }, { status: 201 });
}
