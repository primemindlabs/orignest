/**
 * Phase 31.1 — realtor chat (token-gated). Realtors see ONLY messages explicitly
 * shared with them (visible_to includes 'realtor') and only when the LO has added
 * them to the thread. Financial content never reaches this endpoint by design.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { filterMessages, type ChatMessage } from '@/lib/chat/thread';
import { detectFinancialContent } from '@/lib/chat/financialGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveRealtor(token: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from('portal_realtors')
    .select('id, lead_id, org_id, realtor_name, revoked, approved_by_lo, token_expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data || data.revoked || !data.approved_by_lo) return null;
  if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) return null;
  return data as { id: string; lead_id: string; org_id: string; realtor_name: string };
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const realtor = await resolveRealtor(params.token);
  if (!realtor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sb = createAdminClient();
  const { data: thread } = await sb
    .from('loan_chat_threads')
    .select('id, realtor_in_thread, realtor_portal_id')
    .eq('lead_id', realtor.lead_id)
    .eq('org_id', realtor.org_id)
    .eq('is_internal', false)
    .maybeSingle();
  // Realtor must be explicitly added to this thread.
  if (!thread || !thread.realtor_in_thread || thread.realtor_portal_id !== realtor.id) {
    return NextResponse.json({ messages: [], in_thread: false });
  }

  const { data } = await sb.from('chat_messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true });
  return NextResponse.json({ messages: filterMessages((data ?? []) as ChatMessage[], 'realtor'), in_thread: true });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const realtor = await resolveRealtor(params.token);
  if (!realtor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const content = body?.message?.trim();
  if (!content) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const sb = createAdminClient();
  const { data: thread } = await sb
    .from('loan_chat_threads')
    .select('id, realtor_in_thread, realtor_portal_id')
    .eq('lead_id', realtor.lead_id)
    .eq('org_id', realtor.org_id)
    .eq('is_internal', false)
    .maybeSingle();
  if (!thread || !thread.realtor_in_thread || thread.realtor_portal_id !== realtor.id) {
    return NextResponse.json({ error: 'You have not been added to this conversation.' }, { status: 403 });
  }

  // Realtor messages are visible to LO + realtor only (never auto-shared with borrower).
  const { data, error } = await sb
    .from('chat_messages')
    .insert({
      thread_id: thread.id,
      org_id: realtor.org_id,
      sender_type: 'realtor',
      sender_id: realtor.id,
      content,
      content_type: 'text',
      visible_to: ['lo', 'realtor'],
      financial_content_detected: detectFinancialContent(content),
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Failed to send' }, { status: 500 });

  await sb.from('lead_activities').insert({
    lead_id: realtor.lead_id,
    org_id: realtor.org_id,
    action: 'chat_message_received',
    description: 'Realtor sent a chat message',
    metadata: { source: 'realtor_portal_chat' },
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ message: data });
}
