// Phase 120 — deal-desk thread: list messages + post an LO note.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { requestId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ messages: [] });

  const sb = createAdminClient();
  const { data: req } = await sb.from('ae_deal_desk_requests').select('id').eq('id', params.requestId).eq('org_id', orgId).maybeSingle();
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await sb
    .from('ae_deal_desk_messages')
    .select('*')
    .eq('request_id', params.requestId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { requestId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const body = (b.body ?? '').toString().trim();
  if (!body) return NextResponse.json({ error: 'Empty message' }, { status: 400 });

  const sb = createAdminClient();
  const { data: req } = await sb.from('ae_deal_desk_requests').select('id').eq('id', params.requestId).eq('org_id', orgId).maybeSingle();
  if (!req) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: profile } = await sb.from('profiles').select('id, first_name, last_name').eq('clerk_user_id', userId).maybeSingle();
  const who = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Loan officer' : 'Loan officer';

  const { error } = await sb.from('ae_deal_desk_messages').insert({
    request_id: params.requestId,
    org_id: orgId,
    sender_type: 'lo',
    sender_id: profile?.id ?? null,
    sender_name: who,
    body: body.slice(0, 2000),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
