// Phase 120 — LO accepts the AE's offered pricing → materializes a loan_scenarios row.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeMonthlyPayment } from '@/lib/scenarios/compute';

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, { params }: { params: { requestId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: req } = await sb
    .from('ae_deal_desk_requests')
    .select('*')
    .eq('id', params.requestId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (req.status !== 'responded') return NextResponse.json({ error: 'No AE response to accept yet.' }, { status: 409 });

  const rate = (req.ae_offered_rate as number) ?? (req.requested_rate as number) ?? 0;
  if (!rate) return NextResponse.json({ error: 'No rate on the AE response.' }, { status: 400 });

  const loanAmount = (req.loan_amount as number) ?? 0;
  const term = 360;
  const monthly = computeMonthlyPayment(loanAmount, rate, term);
  const totalPaid = monthly * term;

  // Append as the next scenario for this loan.
  const { count } = await sb
    .from('loan_scenarios')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('lead_id', req.lead_id as string);

  const name = `${req.lender_name ?? 'Lender'} (AE quote)`.slice(0, 120);
  const { data: scenario, error } = await sb
    .from('loan_scenarios')
    .insert({
      org_id: orgId,
      lo_id: req.lo_id,
      lead_id: req.lead_id,
      scenario_name: name,
      sort_order: count ?? 0,
      loan_type: (req.loan_type as string) ?? 'conventional',
      // The deal-desk request is loan-amount based (no purchase price); model it as a
      // 0%-down scenario so loan_amount carries through and the NOT NULL cols are satisfied.
      purchase_price: loanAmount,
      down_payment_pct: 0,
      loan_amount: loanAmount,
      interest_rate: rate,
      loan_term_months: term,
      monthly_payment: Math.round(monthly * 100) / 100,
      total_interest_paid: Math.round(totalPaid - loanAmount),
      total_cost_of_loan: Math.round(totalPaid),
      lender_name: (req.lender_name as string) ?? null,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date().toISOString();
  await sb
    .from('ae_deal_desk_requests')
    .update({ status: 'approved', converted_to_scenario_id: scenario.id, updated_at: now })
    .eq('id', params.requestId)
    .eq('org_id', orgId);

  const { data: profile } = await sb.from('profiles').select('first_name, last_name').eq('clerk_user_id', userId).maybeSingle();
  const who = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'LO' : 'LO';
  await sb.from('ae_deal_desk_messages').insert({
    request_id: params.requestId,
    org_id: orgId,
    sender_type: 'system',
    body: `${who} accepted the AE pricing — added to the loan's scenarios.`,
  });

  return NextResponse.json({ ok: true, scenario_id: scenario.id });
}
