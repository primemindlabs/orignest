import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }): Promise<NextResponse> {
  const sb = createAdminClient();

  const { data: pt } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id')
    .eq('token', params.token)
    .maybeSingle();
  if (!pt) return NextResponse.json({ error: 'Invalid token' }, { status: 404 });

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select(`
      id, status, subscription_status, target_score, trial_ends_at,
      starting_score_exp, starting_score_eqx, starting_score_tu,
      current_score_exp, current_score_eqx, current_score_tu,
      score_history, croa_disclosure_signed_at, created_at
    `)
    .eq('lead_id', pt.lead_id)
    .eq('org_id', pt.org_id)
    .maybeSingle();

  if (!enrollment) return NextResponse.json({ enrolled: false });

  const { data: disputes } = await sb
    .from('credit_disputes')
    .select('id, tradeline_id, bureau, letter_type, cycle_number, response_status, sent_at, expected_response_by, lob_status, ai_next_action, approved_by_borrower_at, letter_body, borrower_name, borrower_address')
    .eq('enrollment_id', enrollment.id)
    .order('created_at', { ascending: false });

  const { data: tradelines } = await sb
    .from('credit_tradelines')
    .select('id, creditor_name, bureau, dispute_status, dispute_priority, estimated_score_gain, is_disputable, dispute_reason, account_type, payment_status')
    .eq('enrollment_id', enrollment.id)
    .order('dispute_priority');

  return NextResponse.json({ enrolled: true, enrollment, disputes: disputes ?? [], tradelines: tradelines ?? [] });
}
