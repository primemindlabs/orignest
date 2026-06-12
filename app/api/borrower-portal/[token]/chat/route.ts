/**
 * Phase 31.1 — borrower/co-borrower chat (token-gated, no Clerk session).
 * Sees only messages where 'borrower'/'coborrower' is in visible_to.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { filterMessages, type ChatMessage, type Viewer } from '@/lib/chat/thread';
import { notifyLoOfPortalEvent } from '@/lib/portal/notifyLoOfPortalEvent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolvePortal(token: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id, expires_at, participant_type')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;
  return data as { lead_id: string; org_id: string; participant_type: string };
}

async function thread(sb: ReturnType<typeof createAdminClient>, leadId: string, orgId: string) {
  const { data } = await sb.from('loan_chat_threads').select('id').eq('lead_id', leadId).eq('org_id', orgId).maybeSingle();
  return data?.id ?? null;
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const portal = await resolvePortal(params.token);
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });
  const viewer: Viewer = portal.participant_type === 'coborrower' ? 'coborrower' : 'borrower';

  const sb = createAdminClient();
  const tid = await thread(sb, portal.lead_id, portal.org_id);
  if (!tid) return NextResponse.json({ messages: [] });

  const { data } = await sb.from('chat_messages').select('*').eq('thread_id', tid).order('created_at', { ascending: true });
  return NextResponse.json({ messages: filterMessages((data ?? []) as ChatMessage[], viewer) });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const portal = await resolvePortal(params.token);
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });
  const senderType = portal.participant_type === 'coborrower' ? 'coborrower' : 'borrower';

  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const content = body?.message?.trim();
  if (!content) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const sb = createAdminClient();
  let tid = await thread(sb, portal.lead_id, portal.org_id);
  if (!tid) {
    // Create the thread so the borrower can start the conversation.
    const { data: lead } = await sb.from('leads').select('assigned_to').eq('id', portal.lead_id).maybeSingle();
    const { data: created } = await sb
      .from('loan_chat_threads')
      .insert({ lead_id: portal.lead_id, org_id: portal.org_id, lo_id: lead?.assigned_to ?? null, borrower_in_thread: true })
      .select('id')
      .single();
    tid = created?.id ?? null;
  }
  if (!tid) return NextResponse.json({ error: 'Unable to start chat' }, { status: 500 });

  const { data, error } = await sb
    .from('chat_messages')
    .insert({ thread_id: tid, org_id: portal.org_id, sender_type: senderType, content, content_type: 'text', visible_to: ['lo', 'borrower', 'coborrower'] })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Failed to send' }, { status: 500 });

  await sb.from('lead_activities').insert({
    lead_id: portal.lead_id,
    org_id: portal.org_id,
    action: 'chat_message_received',
    description: `${senderType === 'coborrower' ? 'Co-borrower' : 'Borrower'} sent a chat message`,
    metadata: { source: 'borrower_portal_chat' },
  }).then(() => undefined, () => undefined);

  // Ping the assigned LO's notification bell (best-effort).
  await notifyLoOfPortalEvent(sb, {
    orgId: portal.org_id,
    leadId: portal.lead_id,
    kind: 'message_received',
    detail: content.slice(0, 100),
  });

  return NextResponse.json({ message: data });
}
