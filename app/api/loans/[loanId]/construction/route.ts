/**
 * Phase 63.3 — construction loan.
 *   GET  → construction loan + draw schedule + docs checklist
 *   POST → create the construction loan, seed a standard draw schedule + docs
 *   PATCH→ draw workflow: request → inspection_ordered → approved/disbursed
 *          (updates total_draws_disbursed; the FINAL draw requires an approved CO).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DRAW_PLAN: [string, number, number][] = [['Foundation', 25, 0.15], ['Framing', 50, 0.2], ['Rough Mechanical', 65, 0.1], ['Drywall', 80, 0.15], ['Finishes', 95, 0.3], ['Final Draw', 100, 0.1]];
const DOC_PLAN: [string, string][] = [['building_plans', 'Building Plans'], ['cost_breakdown', 'Cost Breakdown'], ['builder_contract', 'Builder Contract'], ['builder_license', 'Builder License'], ['builder_insurance', 'Builder Insurance'], ['lot_purchase_contract', 'Lot Purchase Contract'], ['survey', 'Survey'], ['permit', 'Building Permit'], ['co_certificate', 'Certificate of Occupancy']];

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data: cl } = await sb.from('construction_loans').select('*').eq('org_id', orgId).eq('loan_id', params.loanId).maybeSingle();
  if (!cl) return NextResponse.json({ construction_loan: null });
  const [{ data: draws }, { data: docs }] = await Promise.all([
    sb.from('construction_draws').select('*').eq('construction_loan_id', cl.id).order('draw_number'),
    sb.from('construction_docs').select('*').eq('construction_loan_id', cl.id).order('created_at'),
  ]);
  return NextResponse.json({ construction_loan: cl, draws: draws ?? [], docs: docs ?? [] });
}

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { close_type?: string; builder_name?: string; lot_value?: number; construction_cost?: number; construction_loan_amount?: number; project_address?: string };
  if (!['one_time_close', 'two_time_close'].includes(b.close_type ?? '')) return NextResponse.json({ error: 'valid close_type required' }, { status: 400 });
  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const cc = Number(b.construction_cost ?? 0);
  const total = Number(b.lot_value ?? 0) + cc;
  const { data: cl, error } = await sb.from('construction_loans').insert({ org_id: orgId, loan_id: params.loanId, lo_id: profile?.id ?? null, close_type: b.close_type, builder_name: b.builder_name ?? null, project_address: b.project_address ?? null, lot_value: b.lot_value ?? null, construction_cost: b.construction_cost ?? null, total_project_cost: total || null, construction_loan_amount: b.construction_loan_amount ?? null }).select('id').single();
  if (error || !cl) return NextResponse.json({ error: String(error?.message).includes('duplicate') ? 'Construction loan already exists for this file.' : 'save_failed' }, { status: 400 });

  await sb.from('construction_draws').insert(DRAW_PLAN.map(([name, pct, share], i) => ({ org_id: orgId, construction_loan_id: cl.id, draw_number: i + 1, draw_name: name, percentage_complete: pct, budgeted_amount: Math.round(cc * share) })));
  await sb.from('construction_docs').insert(DOC_PLAN.map(([t, n]) => ({ org_id: orgId, construction_loan_id: cl.id, doc_type: t, doc_name: n })));
  return NextResponse.json({ construction_loan_id: cl.id });
}

export async function PATCH(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { draw_id?: string; action?: string; amount?: number; doc_id?: string; doc_status?: string };
  const sb = createAdminClient();

  if (b.doc_id && b.doc_status) {
    await sb.from('construction_docs').update({ status: b.doc_status, received_at: b.doc_status === 'received' ? new Date().toISOString() : undefined, approved_at: b.doc_status === 'approved' ? new Date().toISOString() : undefined }).eq('id', b.doc_id).eq('org_id', orgId);
    return NextResponse.json({ ok: true });
  }
  if (!b.draw_id || !b.action) return NextResponse.json({ error: 'draw_id + action required' }, { status: 400 });
  const { data: draw } = await sb.from('construction_draws').select('*, construction_loans!inner(id, loan_id, org_id)').eq('id', b.draw_id).maybeSingle();
  if (!draw || (draw.construction_loans as { org_id: string }).org_id !== orgId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (b.action === 'request') {
    const next = draw.inspection_required ? 'inspection_ordered' : 'requested';
    await sb.from('construction_draws').update({ status: next, requested_amount: b.amount ?? draw.budgeted_amount, requested_at: new Date().toISOString(), inspection_ordered_at: draw.inspection_required ? new Date().toISOString() : null }).eq('id', b.draw_id);
    return NextResponse.json({ ok: true, status: next });
  }
  if (b.action === 'approve') {
    // CO guard: the final draw (100% complete) requires an approved Certificate of Occupancy.
    if (draw.percentage_complete >= 100) {
      const clId = (draw.construction_loans as { id: string }).id;
      const { data: co } = await sb.from('construction_docs').select('status').eq('construction_loan_id', clId).eq('doc_type', 'co_certificate').maybeSingle();
      if (!co || co.status !== 'approved') return NextResponse.json({ error: 'Certificate of Occupancy must be approved before releasing the final draw.' }, { status: 400 });
    }
    const amount = b.amount ?? draw.requested_amount ?? draw.budgeted_amount;
    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    await sb.from('construction_draws').update({ status: 'disbursed', approved_amount: amount, disbursed_amount: amount, inspection_completed_at: new Date().toISOString(), inspection_passed: true, approved_at: new Date().toISOString(), disbursed_at: new Date().toISOString(), approved_by: profile?.id ?? null }).eq('id', b.draw_id);
    // Recompute total disbursed.
    const clId = (draw.construction_loans as { id: string }).id;
    const { data: all } = await sb.from('construction_draws').select('disbursed_amount').eq('construction_loan_id', clId);
    const totalDisb = (all ?? []).reduce((s, d) => s + Number(d.disbursed_amount ?? 0), 0);
    await sb.from('construction_loans').update({ total_draws_disbursed: totalDisb }).eq('id', clId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
