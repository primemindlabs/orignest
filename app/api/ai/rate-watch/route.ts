import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CURRENT_MARKET_RATE = 6.875; // Placeholder — replace with live FRED/Freddie API

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths = 360): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

async function generateRefiSMS(
  borrowerName: string,
  originalRate: number,
  currentRate: number,
  monthlySavings: number,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 200,
    system:
      'Write a brief, TCPA-compliant SMS from a mortgage LO to a past borrower about a refi opportunity. Max 160 chars. No markdown. Friendly and professional. Include STOP to opt out.',
    messages: [
      {
        role: 'user',
        content: `Borrower: ${borrowerName}. Original rate: ${originalRate}%. Current market: ${currentRate}%. Est. monthly savings: $${Math.round(monthlySavings)}.`,
      },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : `Hi ${borrowerName}, rates have dropped! You could save ~$${Math.round(monthlySavings)}/mo. Reply to learn more. Reply STOP to opt out.`;
}

export async function POST() {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sb = createAdminClient();

    const { data: org } = await sb
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', orgId)
      .single();

    if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

    // Get closed leads with locked rates
    const { data: closedLeads } = await sb
      .from('leads')
      .select('id,first_name,last_name,locked_rate,loan_amount,sms_consent')
      .eq('org_id', org.id)
      .eq('stage', 'closed')
      .eq('rate_locked', true)
      .not('locked_rate', 'is', null)
      .not('loan_amount', 'is', null);

    const opportunities: Array<{
      leadId: string;
      borrowerName: string;
      originalRate: number;
      currentRate: number;
      monthlySavings: number;
      draftSMS: string;
    }> = [];

    for (const lead of closedLeads ?? []) {
      const originalRate = lead.locked_rate as number;
      const loanAmount = lead.loan_amount as number;

      if (CURRENT_MARKET_RATE <= originalRate - 0.75) {
        const originalPayment = calculateMonthlyPayment(loanAmount, originalRate);
        const newPayment = calculateMonthlyPayment(loanAmount, CURRENT_MARKET_RATE);
        const monthlySavings = originalPayment - newPayment;

        if (monthlySavings >= 100) {
          const borrowerName = `${lead.first_name} ${lead.last_name}`;

          // Check for existing watch
          const { data: existing } = await sb
            .from('rate_watch')
            .select('id')
            .eq('lead_id', lead.id)
            .eq('watch_type', 'refi_opportunity')
            .maybeSingle();

          let draftSMS = '';
          if (lead.sms_consent) {
            draftSMS = await generateRefiSMS(lead.first_name, originalRate, CURRENT_MARKET_RATE, monthlySavings);
          }

          if (!existing) {
            await sb.from('rate_watch').insert({
              org_id: org.id,
              lead_id: lead.id,
              watch_type: 'refi_opportunity',
              trigger_rate_threshold: originalRate - 0.75,
              current_rate: CURRENT_MARKET_RATE,
              original_rate: originalRate,
              original_loan_amount: loanAmount,
              monthly_savings: monthlySavings,
              alert_sent: false,
            });
          }

          opportunities.push({
            leadId: lead.id,
            borrowerName,
            originalRate,
            currentRate: CURRENT_MARKET_RATE,
            monthlySavings: Math.round(monthlySavings),
            draftSMS,
          });
        }
      }
    }

    await sb.from('ai_agent_runs').insert({
      org_id: org.id,
      agent_type: 'rate_watch',
      status: 'completed',
      leads_processed: (closedLeads ?? []).length,
      actions_taken: opportunities.length,
      summary: `Found ${opportunities.length} refi opportunities at ${CURRENT_MARKET_RATE}% market rate`,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      opportunities,
      currentMarketRate: CURRENT_MARKET_RATE,
      scanned: (closedLeads ?? []).length,
    });
  } catch (err) {
    console.error('[ai/rate-watch]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Rate watch error' },
      { status: 500 },
    );
  }
}
