/**
 * Phase 144 — one lead's Concierge conversation.
 *   GET  → conversation + transcript
 *   POST → { action: 'set_mode', mode } | { action: 'approve_draft', message_id }
 *
 * approve_draft sends the most recent (or specified) un-sent assistant draft, but
 * only after the same TCPA gate the autonomous path uses.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendSMS } from '@/lib/communications/canSendSMS';
import { sendConciergeSms } from '@/lib/concierge/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODES = ['off', 'suggest', 'autonomous'];

export async function GET(_req: Request, { params }: { params: { leadId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();

  const { data: conv } = await sb.from('ai_conversations')
    .select('id, autonomy_mode, status, escalation_reason, message_count, last_inbound_at, last_ai_reply_at, lo_id')
    .eq('org_id', orgId).eq('lead_id', params.leadId).maybeSingle();
  if (!conv) return NextResponse.json({ conversation: null, messages: [] });

  const { data: messages } = await sb.from('ai_conversation_messages')
    .select('id, role, body, gated, gate_reason, sent, sent_at, tool_trace, created_at')
    .eq('conversation_id', conv.id).order('created_at', { ascending: true });
  return NextResponse.json({ conversation: conv, messages: messages ?? [] });
}

export async function POST(req: Request, { params }: { params: { leadId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  const sb = createAdminClient();

  const b = (await req.json().catch(() => ({}))) as { action?: string; mode?: string; message_id?: string };

  if (b.action === 'set_mode') {
    if (!MODES.includes(b.mode ?? '')) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    const { data: prof } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    await sb.from('ai_conversations').upsert(
      { org_id: orgId, lead_id: params.leadId, lo_id: (prof as { id?: string } | null)?.id ?? null, autonomy_mode: b.mode, status: 'active', updated_at: new Date().toISOString() },
      { onConflict: 'org_id,lead_id' },
    );
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'approve_draft') {
    const { data: conv } = await sb.from('ai_conversations').select('id, lo_id').eq('org_id', orgId).eq('lead_id', params.leadId).maybeSingle();
    if (!conv) return NextResponse.json({ error: 'No conversation' }, { status: 404 });

    let q = sb.from('ai_conversation_messages').select('id, body').eq('conversation_id', conv.id).eq('role', 'assistant').eq('sent', false);
    if (b.message_id) q = q.eq('id', b.message_id);
    const { data: draft } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!draft) return NextResponse.json({ error: 'No pending draft' }, { status: 404 });

    const gate = await canSendSMS(sb, { orgId, leadId: params.leadId, category: 'loan_updates' });
    if (!gate.allowed) return NextResponse.json({ error: gate.reason ?? 'Not permitted to send' }, { status: 422 });

    const res = await sendConciergeSms(sb, { orgId, leadId: params.leadId, loId: (conv as { lo_id: string | null }).lo_id, body: (draft as { body: string }).body });
    if (!res.ok) return NextResponse.json({ error: res.reason ?? 'Send failed' }, { status: 502 });

    await sb.from('ai_conversation_messages').update({ sent: true, sent_at: new Date().toISOString() }).eq('id', (draft as { id: string }).id);
    await sb.from('communications').insert({ lead_id: params.leadId, org_id: orgId, sender_id: (conv as { lo_id: string | null }).lo_id, channel: 'sms', direction: 'outbound', body: (draft as { body: string }).body, consent_status_at_send: true, sent_at: new Date().toISOString() }).then(() => undefined, () => undefined);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
