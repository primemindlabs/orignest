/**
 * Phase 33.3 — create a co-marketing campaign (LO-only).
 * RESPA-gated: the budget split is validated and the LO must acknowledge the
 * RESPA disclosure before the campaign can leave draft.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCoopBudgetSplit } from '@/lib/compliance/respaCoopAdCheck';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();
  const { data } = await sb.from('coop_ad_campaigns').select('*, referral_partners(company_name, first_name, last_name)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50);
  return NextResponse.json({ campaigns: data ?? [] });
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    realtor_id?: string; creative_id?: string; lo_budget_pct?: number; realtor_budget_pct?: number;
    total_budget_cents?: number; respa_acknowledged?: boolean;
  };
  if (!body.realtor_id || body.lo_budget_pct == null || body.realtor_budget_pct == null) {
    return NextResponse.json({ error: 'realtor_id and both budget percentages are required' }, { status: 400 });
  }

  const split = validateCoopBudgetSplit({ lo_percentage: body.lo_budget_pct, realtor_percentage: body.realtor_budget_pct });
  if (!split.compliant) {
    return NextResponse.json({ error: split.warning, code: 'respa_split_invalid' }, { status: 400 });
  }
  // Can't activate without acknowledging the RESPA disclosure.
  const acknowledged = Boolean(body.respa_acknowledged);

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('coop_ad_campaigns')
    .insert({
      org_id: orgId,
      lo_id: userId,
      realtor_id: body.realtor_id,
      creative_id: body.creative_id ?? null,
      lo_budget_pct: body.lo_budget_pct,
      realtor_budget_pct: body.realtor_budget_pct,
      total_budget_cents: body.total_budget_cents ?? null,
      respa_acknowledgment_at: acknowledged ? new Date().toISOString() : null,
      respa_acknowledged_by: acknowledged ? userId : null,
      status: acknowledged ? 'active' : 'draft',
    })
    .select('*')
    .single();
  if (error) {
    console.error('[ad-center/coop] create failed', error);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
  return NextResponse.json({ campaign: data });
}
