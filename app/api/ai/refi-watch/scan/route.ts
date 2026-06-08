import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function estimateBalance(originalAmount: number, annualRate: number, monthsElapsed: number): number {
  const r = annualRate / 100 / 12;
  const n = 360;
  if (r === 0) return Math.max(originalAmount - (originalAmount / n) * monthsElapsed, 0);
  const payment = (originalAmount * (r * Math.pow(1 + r, n))) / (Math.pow(1 + r, n) - 1);
  const balance = originalAmount * Math.pow(1 + r, monthsElapsed) - (payment * (Math.pow(1 + r, monthsElapsed) - 1)) / r;
  return Math.round(Math.max(balance, 0));
}

function monthlyPI(principal: number, annualRate: number, years = 30): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export async function POST(): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const currentRate = parseFloat(process.env.CURRENT_MARKET_RATE || '6.875');

  const { data: closedLeads } = await sb
    .from('leads')
    .select('id, original_rate, original_loan_amount, closed_date, original_loan_program')
    .eq('org_id', org.id)
    .eq('stage', 'closed')
    .not('original_rate', 'is', null)
    .not('original_loan_amount', 'is', null);

  if (!closedLeads?.length) {
    return NextResponse.json({ scanned: 0, opportunities: 0 });
  }

  let opportunitiesFound = 0;

  for (const lead of closedLeads) {
    const originalRate = Number(lead.original_rate);
    const originalAmount = Number(lead.original_loan_amount);
    const spread = originalRate - currentRate;
    if (spread < 0.5) continue; // minimum meaningful savings threshold

    const monthsElapsed = lead.closed_date
      ? Math.max(1, Math.floor((Date.now() - new Date(lead.closed_date as string).getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 24;

    const currentBalance = estimateBalance(originalAmount, originalRate, monthsElapsed);
    const oldPayment = monthlyPI(originalAmount, originalRate);
    const newPayment = monthlyPI(currentBalance, currentRate);
    const monthlySavings = Math.round(oldPayment - newPayment);

    if (monthlySavings < 50) continue;

    const { error } = await sb.from('refi_opportunities').upsert(
      {
        org_id: org.id,
        lead_id: lead.id,
        original_rate: originalRate,
        current_market_rate: currentRate,
        rate_spread: spread,
        monthly_savings: monthlySavings,
        annual_savings: monthlySavings * 12,
        loan_balance_estimate: currentBalance,
        last_checked_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,lead_id', ignoreDuplicates: false }
    );

    if (!error) opportunitiesFound++;
  }

  return NextResponse.json({ scanned: closedLeads.length, opportunities: opportunitiesFound });
}
