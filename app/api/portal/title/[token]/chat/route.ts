/**
 * Phase 31.3 — title agent chat (token-gated). Closing-relevant messages only;
 * financial content never reaches this endpoint by design.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { filterMessages, type ChatMessage } from '@/lib/chat/thread';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolve(token: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from('portal_title_agents')
    .select('id, lead_id, org_id, revoked, approved_by_lo, token_expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data || data.revoked || !data.approved_by_lo) return null;
  if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) return null;
  return data as { id: string; lead_id: string; org_id: string };
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const ta = await resolve(params.token);
  if (!ta) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const sb = createAdminClient();
  const { data: thread } = await sb.from('loan_chat_threads').select('id, title_agent_in_thread, title_agent_portal_id').eq('lead_id', ta.lead_id).eq('org_id', ta.org_id).eq('is_internal', false).maybeSingle();
  if (!thread || !thread.title_agent_in_thread || thread.title_agent_portal_id !== ta.id) return NextResponse.json({ messages: [], in_thread: false });
  const { data } = await sb.from('chat_messages').select('*').eq('thread_id', thread.id).order('created_at', { ascending: true });
  return NextResponse.json({ messages: filterMessages((data ?? []) as ChatMessage[], 'title_agent'), in_thread: true });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const ta = await resolve(params.token);
  if (!ta) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const content = body?.message?.trim();
  if (!content) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const sb = createAdminClient();
  const { data: thread } = await sb.from('loan_chat_threads').select('id, title_agent_in_thread, title_agent_portal_id').eq('lead_id', ta.lead_id).eq('org_id', ta.org_id).eq('is_internal', false).maybeSingle();
  if (!thread || !thread.title_agent_in_thread || thread.title_agent_portal_id !== ta.id) {
    return NextResponse.json({ error: 'You have not been added to this conversation.' }, { status: 403 });
  }
  const { data, error } = await sb
    .from('chat_messages')
    .insert({ thread_id: thread.id, org_id: ta.org_id, sender_type: 'title_agent', sender_id: ta.id, content, content_type: 'text', visible_to: ['lo', 'title_agent'] })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  return NextResponse.json({ message: data });
}
