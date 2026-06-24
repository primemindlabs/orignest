/**
 * Phase 146 — POST /api/widget/[key]/message : one visitor turn.
 * Public (key + session_token gated). Persists the visitor message, runs the web
 * agent, persists + returns the reply. Captures a lead when the agent collects
 * enough contact info.
 */
import { NextResponse } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { runWebAgent } from '@/lib/widget/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const b = (await req.json().catch(() => ({}))) as { session_token?: string; message?: string };
  const text = (b.message ?? '').trim();
  if (!b.session_token || !text) return NextResponse.json({ error: 'session_token and message are required' }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 413 });

  const sb = createAdminClient();
  const { data: widget } = await sb.from('ai_web_widgets').select('id, org_id, lo_id, enabled').eq('public_key', params.key).maybeSingle();
  if (!widget || !widget.enabled) return NextResponse.json({ error: 'Widget unavailable' }, { status: 404 });

  const { data: session } = await sb.from('ai_web_sessions').select('id, captured, message_count').eq('session_token', b.session_token).eq('widget_id', widget.id).maybeSingle();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if ((session.message_count ?? 0) > 40) return NextResponse.json({ reply: "Thanks for chatting! A loan officer will follow up with you shortly." });

  // Persist the visitor turn + load history.
  await sb.from('ai_web_messages').insert({ session_id: session.id, org_id: widget.org_id, role: 'visitor', body: text }).then(() => undefined, () => undefined);
  const { data: hist } = await sb.from('ai_web_messages').select('role, body').eq('session_id', session.id).order('created_at', { ascending: true }).limit(20);
  const history: Anthropic.MessageParam[] = (hist ?? [])
    .slice(0, -1) // the row we just inserted is added by the agent as inboundText
    .map((m) => ({ role: m.role === 'visitor' ? 'user' : 'assistant', content: m.body } as Anthropic.MessageParam));

  const { reply, captured } = await runWebAgent(sb, {
    widget: { id: widget.id, org_id: widget.org_id, lo_id: widget.lo_id },
    session: { id: session.id, captured: session.captured },
    history, inboundText: text,
  });

  await sb.from('ai_web_messages').insert({ session_id: session.id, org_id: widget.org_id, role: 'assistant', body: reply }).then(() => undefined, () => undefined);
  await sb.from('ai_web_sessions').update({ message_count: (session.message_count ?? 0) + 1, last_activity_at: new Date().toISOString() }).eq('id', session.id).then(() => undefined, () => undefined);

  return NextResponse.json({ reply, captured });
}
