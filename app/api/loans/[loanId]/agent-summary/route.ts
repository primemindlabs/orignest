/**
 * Phase 55.3 — agent-safe loan status summary. Returns ONLY agent-visible
 * conditions (income/credit/asset excluded), using the agent-friendly description
 * when set, never the internal condition text. White-labeled to the LO/company.
 *   GET   → filtered summary JSON (safe to share with the realtor)
 *   PATCH → toggle a condition's is_agent_visible / agent_visible_description
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDefaultAgentVisibility } from '@/lib/conditions/agentVisibility';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const [{ data: lead }, { data: conditions }, { data: org }] = await Promise.all([
    sb.from('leads').select('id, first_name, last_name, property_address, closing_date, assigned_to').eq('id', params.loanId).eq('org_id', orgId).maybeSingle(),
    sb.from('loan_conditions').select('id, condition_text, agent_visible_description, is_agent_visible, status, category').eq('lead_id', params.loanId).eq('org_id', orgId),
    sb.from('organizations').select('name').eq('id', orgId).maybeSingle(),
  ]);
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Only conditions explicitly marked agent-visible (income/credit never leak).
  const visible = (conditions ?? []).filter((c) => c.is_agent_visible).map((c) => ({
    id: c.id, title: c.agent_visible_description || c.condition_text, status: c.status,
  }));
  let loName = 'Your Loan Officer';
  if (lead.assigned_to) { const { data: lo } = await sb.from('profiles').select('first_name, last_name').eq('id', lead.assigned_to).maybeSingle(); if (lo) loName = `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() || loName; }

  return NextResponse.json({
    borrower_name: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),
    property_address: lead.property_address, closing_date: lead.closing_date,
    conditions: visible, outstanding: visible.filter((c) => c.status !== 'cleared').length,
    lo_name: loName, company_name: org?.name ?? '', generated_at: new Date().toISOString(),
  });
}

export async function PATCH(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { condition_id?: string; is_agent_visible?: boolean; agent_visible_description?: string; apply_defaults?: boolean };
  const sb = createAdminClient();

  if (b.apply_defaults) {
    // Backfill: set is_agent_visible from category defaults for this loan's conditions.
    const { data: conds } = await sb.from('loan_conditions').select('id, category').eq('lead_id', params.loanId).eq('org_id', orgId);
    for (const c of conds ?? []) await sb.from('loan_conditions').update({ is_agent_visible: getDefaultAgentVisibility(c.category) }).eq('id', c.id).eq('org_id', orgId);
    return NextResponse.json({ ok: true, applied: (conds ?? []).length });
  }
  if (!b.condition_id) return NextResponse.json({ error: 'condition_id required' }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (b.is_agent_visible !== undefined) patch.is_agent_visible = b.is_agent_visible;
  if (b.agent_visible_description !== undefined) patch.agent_visible_description = b.agent_visible_description || null;
  await sb.from('loan_conditions').update(patch).eq('id', b.condition_id).eq('org_id', orgId);
  return NextResponse.json({ ok: true });
}
