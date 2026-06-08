import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDisputeForTradeline } from '@/lib/credit-repair/letters';

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

  const body = (await req.json()) as { enrollmentId: string; borrowerName: string; borrowerAddress: string; tradelineIds?: string[] };

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, croa_disclosure_signed_at')
    .eq('id', body.enrollmentId)
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id)
    .maybeSingle();
  if (!enrollment?.croa_disclosure_signed_at) return NextResponse.json({ error: 'CROA not signed' }, { status: 403 });

  let query = sb
    .from('credit_tradelines')
    .select('id, creditor_name, account_number, dispute_reason, bureau')
    .eq('enrollment_id', body.enrollmentId)
    .eq('is_disputable', true)
    .in('dispute_status', ['identified', 'queued']);
  if (body.tradelineIds?.length) query = query.in('id', body.tradelineIds);
  const { data: tradelines } = await query.order('dispute_priority');

  if (!tradelines?.length) return NextResponse.json({ letters: [], count: 0 });

  const letters: Array<{ disputeId: string; bureau: string; creditor: string; letterBody: string }> = [];

  for (const tl of tradelines) {
    const bureaus = tl.bureau === 'all_three' ? ['experian', 'equifax', 'transunion'] : [tl.bureau as string];
    for (const bureau of bureaus) {
      const result = await createDisputeForTradeline(sb, {
        enrollmentId: body.enrollmentId,
        orgId: pt.org_id as string,
        tradeline: { id: tl.id as string, creditor_name: tl.creditor_name as string, account_number: (tl.account_number as string) ?? null, dispute_reason: (tl.dispute_reason as string) ?? null },
        bureau,
        letterType: 'initial',
        cycleNumber: 1,
        borrowerName: body.borrowerName,
        borrowerAddress: body.borrowerAddress,
      });
      if (result) letters.push({ disputeId: result.id, bureau, creditor: result.creditor, letterBody: result.letterBody });
    }
    await sb.from('credit_tradelines').update({ dispute_status: 'queued' }).eq('id', tl.id);
  }

  return NextResponse.json({ letters, count: letters.length });
}
