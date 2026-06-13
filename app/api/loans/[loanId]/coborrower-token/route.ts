/**
 * Phase 31.3 — issue a co-borrower portal token (LO-only).
 * Same loan thread as the borrower, separate auth (participant_type='coborrower').
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  // Reuse an existing co-borrower token if present.
  const { data: existing } = await sb
    .from('borrower_portal_tokens')
    .select('token')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .eq('participant_type', 'coborrower')
    .maybeSingle();
  if (existing) return NextResponse.json({ portal_url: `/status/${existing.token}` });

  const token = randomBytes(32).toString('hex');
  const { data: created, error } = await sb
    .from('borrower_portal_tokens')
    .insert({
      lead_id: params.loanId,
      org_id: orgId,
      token,
      participant_type: 'coborrower',
      expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    })
    .select('token')
    .single();
  if (error) return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });

  // Mark the thread as including a co-borrower.
  await sb.from('loan_chat_threads').update({ coborrower_in_thread: true }).eq('lead_id', params.loanId).eq('org_id', orgId).eq('is_internal', false).then(() => undefined, () => undefined);

  return NextResponse.json({ portal_url: `/status/${created.token}` });
}
