/**
 * Phase 64.2 — HOA warrantability questionnaire.
 *   GET   → saved questionnaire for the loan
 *   PATCH → upsert fields + recompute warrantability_status server-side (authoritative)
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { assessWarrantability } from '@/lib/hoa/warrantability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FIELDS = ['project_name', 'project_address', 'project_type', 'total_units', 'units_owner_occupied', 'units_investor_owned', 'owner_occupancy_pct', 'single_investor_pct', 'reserve_pct_of_budget', 'delinquency_pct_30_plus', 'pending_special_assessment', 'special_assessment_amount', 'hazard_insurance_adequate', 'flood_insurance_required', 'flood_insurance_obtained', 'fidelity_bond_obtained', 'pending_litigation', 'litigation_insurance_covered', 'construction_defect_litigation', 'physical_deficiencies', 'deficiency_description', 'commercial_space_pct'];

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('hoa_questionnaires').select('*').eq('org_id', orgId).eq('loan_id', params.loanId).maybeSingle();
  return NextResponse.json({ questionnaire: data });
}

export async function PATCH(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = { org_id: orgId, loan_id: params.loanId, updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (f in b) patch[f] = b[f] === '' ? null : b[f];

  const result = assessWarrantability(b);
  patch.warrantability_status = result.status;
  patch.disqualifying_factors = result.disqualifying_factors;
  patch.conditions = result.conditional_factors;
  patch.assessed_at = new Date().toISOString();

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  patch.assessed_by = profile?.id ?? null;
  await sb.from('hoa_questionnaires').upsert(patch, { onConflict: 'loan_id' });
  return NextResponse.json({ ok: true, result });
}
