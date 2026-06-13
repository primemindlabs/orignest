// Phase 109 — per-loan INTERNAL team chat (LO + processors/LOAs/branch managers).
// Reuses chat_messages on a dedicated internal thread; access derived from existing
// role/assignment data (no watchers table). Polling on the client (no Realtime).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRoleForUser } from '@/lib/roles/getRoleForUser';
import { getOrCreateInternalThread } from '@/lib/chat/thread';
import { canAccessInternalChat } from '@/lib/chat/internalAccess';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ loanId: string }> };
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  branch_manager: 'Branch Manager',
  lo: 'Loan Officer',
  loa: 'LOA',
  processor: 'Processor',
};

async function resolveActor(sb: ReturnType<typeof createAdminClient>, userId: string, orgId: string) {
  const role = await getRoleForUser(sb, userId, orgId);
  return role.profileId ? { profileId: role.profileId, role: role.role as string } : null;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const actor = await resolveActor(sb, userId, orgId);
  if (!actor) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  if (!(await canAccessInternalChat(sb, orgId, loanId, actor))) {
    return NextResponse.json({ error: 'Not authorized for this loan file' }, { status: 403 });
  }

  const thread = await getOrCreateInternalThread(sb, orgId, loanId);
  if (!thread) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const { data: rows } = await sb
    .from('chat_messages')
    .select('id, sender_id, content, content_type, created_at')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(200);

  const senderIds = Array.from(new Set((rows ?? []).map((r) => r.sender_id).filter(Boolean))) as string[];
  const nameById = new Map<string, string>();
  const roleById = new Map<string, string>();
  if (senderIds.length) {
    const [{ data: profs }, { data: roles }] = await Promise.all([
      sb.from('profiles').select('id, first_name, last_name').in('id', senderIds),
      sb.from('user_roles').select('user_id, role').eq('org_id', orgId).eq('is_active', true).in('user_id', senderIds),
    ]);
    for (const p of profs ?? []) nameById.set(p.id as string, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Team member');
    for (const r of roles ?? []) if (!roleById.has(r.user_id as string)) roleById.set(r.user_id as string, r.role as string);
  }

  const messages = (rows ?? []).map((r) => ({
    id: r.id,
    content: r.content,
    content_type: r.content_type,
    created_at: r.created_at,
    sender_id: r.sender_id,
    sender_name: r.sender_id ? nameById.get(r.sender_id as string) ?? 'Team member' : 'System',
    sender_role: r.sender_id ? ROLE_LABEL[roleById.get(r.sender_id as string) ?? ''] ?? '' : '',
    is_self: r.sender_id === actor.profileId,
  }));

  // Best-effort read receipts for messages not sent by me.
  try {
    const unread = (rows ?? []).filter((r) => r.sender_id && r.sender_id !== actor.profileId);
    if (unread.length) {
      const { data: seen } = await sb
        .from('chat_read_receipts')
        .select('message_id')
        .eq('reader_id', actor.profileId)
        .in('message_id', unread.map((u) => u.id));
      const seenSet = new Set((seen ?? []).map((s) => s.message_id));
      const toInsert = unread
        .filter((u) => !seenSet.has(u.id))
        .map((u) => ({ message_id: u.id, thread_id: thread.id, org_id: orgId, reader_type: 'internal', reader_id: actor.profileId }));
      if (toInsert.length) await sb.from('chat_read_receipts').insert(toInsert);
    }
  } catch {
    /* read receipts are best-effort */
  }

  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: Ctx) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const content = (body.message ?? '').trim();
  if (!content) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const sb = createAdminClient();
  const actor = await resolveActor(sb, userId, orgId);
  if (!actor) return NextResponse.json({ error: 'No profile' }, { status: 403 });
  if (!(await canAccessInternalChat(sb, orgId, loanId, actor))) {
    return NextResponse.json({ error: 'Not authorized for this loan file' }, { status: 403 });
  }

  const thread = await getOrCreateInternalThread(sb, orgId, loanId);
  if (!thread) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const { data: inserted, error } = await sb
    .from('chat_messages')
    .insert({
      thread_id: thread.id,
      org_id: orgId,
      sender_type: 'internal',
      sender_id: actor.profileId,
      content,
      content_type: 'text',
      visible_to: ['internal'],
      financial_content_detected: false,
    })
    .select('id, created_at')
    .single();
  if (error) {
    console.error('[internal-chat] insert failed', error);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }

  await sb.from('loan_chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', thread.id);
  return NextResponse.json({ ok: true, id: inserted.id });
}
