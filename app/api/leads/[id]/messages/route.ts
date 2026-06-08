import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// LO-side of two-way borrower messaging (Phase 4.2).
async function ownedLead(sb: ReturnType<typeof createAdminClient>, leadId: string, orgId: string) {
  const { data } = await sb.from('leads').select('id').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  return !!data;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  if (!(await ownedLead(sb, params.id, orgId)))
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { data: messages } = await sb
    .from('portal_messages')
    .select('id, sender_type, message, created_at')
    .eq('lead_id', params.id)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  await sb
    .from('portal_messages')
    .update({ read_by_lo: true })
    .eq('lead_id', params.id)
    .eq('sender_type', 'borrower')
    .eq('read_by_lo', false);

  return NextResponse.json({ messages: messages ?? [] });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message?.trim();
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const sb = createAdminClient();
  if (!(await ownedLead(sb, params.id, orgId)))
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  const { data, error } = await sb
    .from('portal_messages')
    .insert({
      org_id: orgId,
      lead_id: params.id,
      sender_type: 'lo',
      sender_id: (profile?.id as string | undefined) ?? null,
      message,
      read_by_lo: true,
      read_by_borrower: false,
    })
    .select('id, sender_type, message, created_at')
    .single();
  if (error) return NextResponse.json({ error: 'Failed to send' }, { status: 500 });

  // TODO: Resend email to borrower with a magic link once RESEND_API_KEY is set.
  return NextResponse.json({ message: data });
}
