import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyLoOfPortalEvent } from '@/lib/portal/notifyLoOfPortalEvent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Token-authenticated borrower messaging (Phase 4.2). The portal token IS the auth.
async function resolvePortal(token: string) {
  const sb = createAdminClient();
  const { data } = await sb
    .from('borrower_portal_tokens')
    .select('lead_id, org_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;
  return data as { lead_id: string; org_id: string };
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const portal = await resolvePortal(params.token);
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });

  const sb = createAdminClient();
  const { data: messages } = await sb
    .from('portal_messages')
    .select('id, sender_type, message, created_at')
    .eq('lead_id', portal.lead_id)
    .eq('org_id', portal.org_id)
    .order('created_at', { ascending: true });

  // Mark LO messages as read by the borrower.
  await sb
    .from('portal_messages')
    .update({ read_by_borrower: true })
    .eq('lead_id', portal.lead_id)
    .eq('sender_type', 'lo')
    .eq('read_by_borrower', false);

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const portal = await resolvePortal(params.token);
  if (!portal) return NextResponse.json({ error: 'Invalid portal link' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('portal_messages')
    .insert({
      org_id: portal.org_id,
      lead_id: portal.lead_id,
      sender_type: 'borrower',
      message,
      read_by_borrower: true,
      read_by_lo: false,
    })
    .select('id, sender_type, message, created_at')
    .single();
  if (error) return NextResponse.json({ error: 'Failed to send' }, { status: 500 });

  // Surface on the LO timeline.
  await sb.from('lead_activities').insert({
    lead_id: portal.lead_id,
    org_id: portal.org_id,
    action: 'portal_message_received',
    description: 'Borrower sent a portal message',
    metadata: { source: 'borrower_portal' },
  });

  // Ping the assigned LO's notification bell (best-effort).
  await notifyLoOfPortalEvent(sb, {
    orgId: portal.org_id as string,
    leadId: portal.lead_id as string,
    kind: 'message_received',
    detail: message.slice(0, 100),
  });

  return NextResponse.json({ message: data });
}
