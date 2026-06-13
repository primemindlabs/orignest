// Speed-to-lead: stamp first contact (sets the clock that the Respond-Now queue tracks).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const channel = (body?.channel ?? 'manual').toString();

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, first_contacted_at').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_contacted_at: now };
  if (!lead.first_contacted_at) patch.first_contacted_at = now;

  const { error } = await sb.from('leads').update(patch).eq('id', params.id).eq('org_id', orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, channel, firstContact: !lead.first_contacted_at });
}
