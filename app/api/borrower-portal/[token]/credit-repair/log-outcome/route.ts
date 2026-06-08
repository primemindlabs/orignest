import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { createDisputeForTradeline, type LetterType } from '@/lib/credit-repair/letters';
import { notifyLO } from '@/lib/credit-repair/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest, { params }: { params: { token: string } }): Promise<NextResponse> {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid' }, { status: 403 });

  const { disputeId, outcome, enrollmentId } = (await req.json()) as {
    disputeId: string;
    outcome: 'item_removed' | 'item_updated' | 'verified_accurate' | 'no_response';
    enrollmentId: string;
  };

  const { data: dispute } = await sb
    .from('credit_disputes')
    .select('*, credit_tradelines(id, creditor_name, account_number, dispute_reason)')
    .eq('id', disputeId)
    .eq('org_id', pt.org_id)
    .maybeSingle();
  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const tradeline = dispute.credit_tradelines as { id: string; creditor_name: string; account_number: string | null; dispute_reason: string | null } | null;

  let nextAction = '';
  let autoGenerateFollowUp = false;

  if (outcome === 'item_removed') {
    nextAction = 'Great news — this item was removed! Your credit score should improve within 30-45 days.';
    await sb.from('credit_tradelines').update({ dispute_status: 'removed' }).eq('id', dispute.tradeline_id);
    await notifyLO(sb, {
      orgId: pt.org_id as string, enrollmentId, leadId: pt.lead_id as string,
      type: 'item_removed',
      payload: { creditor: tradeline?.creditor_name, bureau: dispute.bureau },
      via: ['in_app', 'email'],
    });
  } else if (outcome === 'verified_accurate') {
    autoGenerateFollowUp = true;
    await sb.from('credit_tradelines').update({ dispute_status: 'verified' }).eq('id', dispute.tradeline_id);
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: `A credit bureau responded "verified" to a dispute for ${tradeline?.creditor_name ?? 'an account'} (cycle ${dispute.cycle_number}). In 2 sentences, explain the best next step to the consumer in plain language.` }],
      });
      const b = resp.content[0];
      nextAction = b.type === 'text' ? b.text.trim() : '';
    } catch { nextAction = 'The bureau verified the item. We will escalate with a method-of-verification demand.'; }
  } else if (outcome === 'no_response') {
    autoGenerateFollowUp = true;
    nextAction = 'The bureau did not respond within 30 days. Under the FCRA they must remove unverified items — we will send a follow-up.';
  } else {
    nextAction = 'Thanks for the update. We have logged the bureau response.';
  }

  await sb.from('credit_disputes').update({
    response_status: outcome,
    borrower_outcome: outcome,
    response_logged_at: new Date().toISOString(),
    ai_next_action: nextAction,
  }).eq('id', disputeId);

  await notifyLO(sb, {
    orgId: pt.org_id as string, enrollmentId, leadId: pt.lead_id as string,
    type: 'bureau_response', payload: { outcome, creditor: tradeline?.creditor_name, bureau: dispute.bureau }, via: ['in_app'],
  });

  // Auto-generate the next-round letter for the same tradeline + bureau.
  let nextDisputeId: string | null = null;
  if (autoGenerateFollowUp && tradeline) {
    const nextCycle = (dispute.cycle_number as number) + 1;
    const nextType: LetterType = nextCycle >= 3 ? 'cfpb_complaint' : 'method_of_verification';
    const result = await createDisputeForTradeline(sb, {
      enrollmentId,
      orgId: pt.org_id as string,
      tradeline,
      bureau: dispute.bureau as string,
      letterType: nextType,
      cycleNumber: nextCycle,
      borrowerName: dispute.borrower_name as string,
      borrowerAddress: dispute.borrower_address as string,
      previousResponse: outcome === 'no_response' ? 'No response received within the statutory 30-day window.' : 'Bureau claimed the item was verified as accurate.',
    });
    if (result) {
      nextDisputeId = result.id;
      await sb.from('credit_disputes').update({ auto_next_letter_id: result.id }).eq('id', disputeId);
      await sb.from('credit_tradelines').update({ dispute_status: 'queued' }).eq('id', tradeline.id);
    }
  }

  return NextResponse.json({ nextAction, nextDisputeId });
}
