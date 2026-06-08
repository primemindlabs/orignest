import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCertifiedLetter } from '@/lib/credit-repair/lob';
import { notifyLO } from '@/lib/credit-repair/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { token: string } }): Promise<NextResponse> {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 403 });

  const { disputeIds } = (await req.json()) as { disputeIds: string[] };
  if (!disputeIds?.length) return NextResponse.json({ error: 'No disputes specified' }, { status: 400 });

  const { data: disputes } = await sb
    .from('credit_disputes')
    .select('id, tradeline_id, enrollment_id, bureau, letter_body, borrower_name, borrower_address, bureau_address')
    .in('id', disputeIds)
    .eq('org_id', pt.org_id)
    .is('sent_at', null);

  if (!disputes?.length) return NextResponse.json({ error: 'No pending disputes found' }, { status: 404 });

  const results: Array<{ disputeId: string; status: string; lobId?: string; error?: string }> = [];

  for (const dispute of disputes) {
    const send = await sendCertifiedLetter({
      description: `Credit Dispute — ${dispute.bureau} — ${(dispute.borrower_name as string) ?? 'Account'}`,
      borrowerName: dispute.borrower_name as string,
      borrowerAddress: dispute.borrower_address as string,
      bureauAddress: dispute.bureau_address as string,
      letterBody: dispute.letter_body as string,
    });

    if (send.status === 'failed') {
      results.push({ disputeId: dispute.id as string, status: 'failed', error: send.error });
      continue;
    }

    const sentAt = new Date();
    await sb.from('credit_disputes').update({
      lob_letter_id: send.lobId,
      lob_status: send.status,
      sent_at: sentAt.toISOString(),
      approved_by_borrower_at: sentAt.toISOString(),
      expected_response_by: new Date(sentAt.getTime() + 37 * 24 * 60 * 60 * 1000).toISOString(),
      response_status: 'awaiting_response',
    }).eq('id', dispute.id);

    await sb.from('credit_tradelines').update({ dispute_status: 'letter_sent' }).eq('id', dispute.tradeline_id);
    results.push({ disputeId: dispute.id as string, status: 'sent', lobId: send.lobId });
  }

  const sentCount = results.filter((r) => r.status === 'sent').length;
  if (sentCount > 0) {
    await notifyLO(sb, {
      orgId: pt.org_id as string,
      enrollmentId: disputes[0].enrollment_id as string,
      leadId: pt.lead_id as string,
      type: 'dispute_sent',
      payload: { count: sentCount },
      via: ['in_app'],
    });
  }

  return NextResponse.json({ results });
}
