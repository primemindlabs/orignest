/**
 * Phase 44.9 — run a Scenario AI analysis and log it (scenario_runs, INSERT-only).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeScenario, type ScenarioInputs, type PreferredLender } from '@/lib/scenarioAI/analyze';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI is not configured.' }, { status: 501 });

  const body = (await req.json().catch(() => ({}))) as { lead_id?: string; inputs?: ScenarioInputs; scenario_type?: string; quick_pick_key?: string };
  const inputs = body.inputs ?? {};

  const sb = createAdminClient();
  // Use the existing `lenders` matrix (managed at /lenders) as the knowledge base.
  const [{ data: rawLenders }, { data: org }, { data: profile }] = await Promise.all([
    sb.from('lenders').select('id, name, channel, ae_name, ae_phone, ae_email, products, min_fico, max_ltv, specialty_tags, notes, is_preferred').eq('org_id', orgId),
    sb.from('organizations').select('name, licensed_states, lender_matrix_prompt').eq('id', orgId).maybeSingle(),
    sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle(),
  ]);

  // Map the existing lenders schema → the analyzer's PreferredLender shape.
  const lenders: PreferredLender[] = (rawLenders ?? []).map((l: Record<string, unknown>) => ({
    id: String(l.id), lender_name: String(l.name ?? ''), lender_type: String(l.channel ?? 'wholesale'),
    ae_name: (l.ae_name as string) ?? null, ae_email: (l.ae_email as string) ?? null, ae_phone: (l.ae_phone as string) ?? null,
    loan_types: Array.isArray(l.products) ? (l.products as string[]) : [],
    min_fico: (l.min_fico as number) ?? null,
    max_ltv: l.max_ltv != null ? Number(l.max_ltv) / 100 : null, // stored as percent (0–110) → decimal
    min_loan_amt: null, max_loan_amt: null,
    notes: [l.notes, Array.isArray(l.specialty_tags) && (l.specialty_tags as string[]).length ? `Tags: ${(l.specialty_tags as string[]).join(', ')}` : ''].filter(Boolean).join(' · ') || null,
    overlay_notes: {}, is_active: true,
  }));

  const result = await analyzeScenario(inputs, lenders, {
    company_name: org?.name ?? 'Your Company',
    state_licenses: Array.isArray(org?.licensed_states) ? org!.licensed_states : [],
    custom_prompt: org?.lender_matrix_prompt ?? null,
  });

  await sb.from('scenario_runs').insert({
    lead_id: body.lead_id ?? null, org_id: orgId, run_by: profile?.id ?? null,
    scenario_inputs: inputs, scenario_type: body.scenario_type ?? 'full_analysis', quick_pick_key: body.quick_pick_key ?? null,
    result, lenders_matched: result.matched_lenders.map((l) => l.id),
  }).then(() => undefined, () => undefined);

  return NextResponse.json(result);
}
