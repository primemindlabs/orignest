/**
 * Phase 31.1 — add a participant to the loan chat thread (LO-only).
 * A realtor is ONLY added when the LO explicitly grants access here.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrCreateThread } from '@/lib/chat/thread';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    participant_type?: 'realtor' | 'coborrower' | 'title_agent';
    participant_id?: string;
    auto?: boolean;
    realtor_sees_borrower_messages?: boolean;
  };
  const type = body.participant_type;
  if (!type || !['realtor', 'coborrower', 'title_agent'].includes(type)) {
    return NextResponse.json({ error: 'Invalid participant type' }, { status: 400 });
  }

  const sb = createAdminClient();
  const thread = await getOrCreateThread(sb, orgId, params.loanId);
  if (!thread) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let label = '';

  if (type === 'realtor') {
    // Resolve by explicit id, else auto-pick the loan's approved, non-revoked realtor.
    const q = sb.from('portal_realtors').select('id, realtor_name').eq('org_id', orgId);
    const { data: realtor } = body.participant_id
      ? await q.eq('id', body.participant_id).maybeSingle()
      : await q.eq('lead_id', params.loanId).eq('revoked', false).eq('approved_by_lo', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!realtor) return NextResponse.json({ error: 'No approved realtor on this loan. Grant Realtor Access first.' }, { status: 404 });
    patch.realtor_in_thread = true;
    patch.realtor_portal_id = realtor.id;
    patch.realtor_sees_borrower_messages = body.realtor_sees_borrower_messages ?? false;
    label = `${realtor.realtor_name} (realtor) was added to the chat.`;
  } else if (type === 'coborrower') {
    patch.coborrower_in_thread = true;
    label = 'Co-borrower was added to the chat.';
  } else if (type === 'title_agent') {
    if (body.participant_id) patch.title_agent_portal_id = body.participant_id;
    patch.title_agent_in_thread = true;
    label = 'Title agent was added to the chat.';
  }

  await sb.from('loan_chat_threads').update(patch).eq('id', thread.id);

  // System message announcing the addition (visible to all current participants).
  await sb.from('chat_messages').insert({
    thread_id: thread.id,
    org_id: orgId,
    sender_type: 'system',
    content: label,
    content_type: 'system',
    visible_to: ['lo', 'borrower', 'coborrower', 'realtor', 'title_agent'],
  });

  return NextResponse.json({ ok: true });
}
