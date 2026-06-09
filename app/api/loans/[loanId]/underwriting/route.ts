import { NextRequest, NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// DTI is auto-calculated from income + housing + debts, unless overridden.
function computeDti(income: number, housing: number, debts: number) {
  if (income <= 0) return { front: null as number | null, back: null as number | null };
  const front = Math.round((housing / income) * 1000) / 10;
  const back = Math.round(((housing + debts) / income) * 1000) / 10;
  return { front, back };
}

async function resolveLead(orgId: string, leadId: string) {
  const sb = createAdminClient();
  const { data } = await sb.from('leads').select('id').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  return data;
}

// GET — DTI worksheet + UW file (creates rows if absent).
export async function GET(_req: NextRequest, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!(await resolveLead(orgId, params.loanId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sb = createAdminClient();
  let { data: dti } = await sb.from('dti_worksheets').select('*').eq('lead_id', params.loanId).maybeSingle();
  if (!dti) {
    const { data } = await sb.from('dti_worksheets').insert({ org_id: orgId, lead_id: params.loanId }).select('*').single();
    dti = data;
  }
  let { data: uw } = await sb.from('uw_files').select('*').eq('lead_id', params.loanId).maybeSingle();
  if (!uw) {
    const { data } = await sb.from('uw_files').insert({ org_id: orgId, lead_id: params.loanId }).select('*').single();
    uw = data;
  }
  return NextResponse.json({ dti, uw });
}

// PUT — body: { type:'dti', total_monthly_income, proposed_housing_payment, other_monthly_debts, overrides }
//             | { type:'uw', risk_score?, risk_factors?, status?, decision?, decision_notes? }
export async function PUT(req: NextRequest, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });
  if (!(await resolveLead(orgId, params.loanId))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const sb = createAdminClient();
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  if (body.type === 'dti') {
    const income = num(body.total_monthly_income);
    const housing = num(body.proposed_housing_payment);
    const debts = num(body.other_monthly_debts);
    const overrides = (body.overrides ?? {}) as Record<string, unknown>;
    const auto = computeDti(income, housing, debts);
    const front = overrides.front_end_dti != null ? num(overrides.front_end_dti) : auto.front;
    const back = overrides.back_end_dti != null ? num(overrides.back_end_dti) : auto.back;
    const { data, error } = await sb.from('dti_worksheets').update({
      total_monthly_income: income, proposed_housing_payment: housing, other_monthly_debts: debts,
      front_end_dti: front, back_end_dti: back, overrides, updated_at: new Date().toISOString(),
    }).eq('lead_id', params.loanId).eq('org_id', orgId).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ dti: data });
  }

  if (body.type === 'uw') {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.risk_score != null) update.risk_score = Math.max(0, Math.min(100, Math.round(num(body.risk_score))));
    if (Array.isArray(body.risk_factors)) update.risk_factors = body.risk_factors;
    if (typeof body.status === 'string') update.status = body.status;
    if (body.decision !== undefined) {
      update.decision = body.decision || null;
      if (body.decision) { update.decided_at = new Date().toISOString(); }
      if (typeof body.decision_notes === 'string') update.decision_notes = body.decision_notes;
    }
    const { data, error } = await sb.from('uw_files').update(update).eq('lead_id', params.loanId).eq('org_id', orgId).select('*').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ uw: data });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
