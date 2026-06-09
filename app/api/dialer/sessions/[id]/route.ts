/**
 * Phase 33.8 — dialer session detail: session + queue (with lead info, in order).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: session } = await sb.from('dialer_sessions').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: items } = await sb
    .from('dialer_queue_items')
    .select('id, lead_id, position, status')
    .eq('session_id', params.id)
    .order('position', { ascending: true });

  const leadIds = (items ?? []).map((i) => i.lead_id);
  const { data: leads } = leadIds.length
    ? await sb.from('leads').select('id, first_name, last_name, phone, property_state, stage, loan_type, loan_amount').in('id', leadIds).eq('org_id', orgId)
    : { data: [] };
  const leadById = new Map((leads ?? []).map((l) => [l.id, l]));

  const queue = (items ?? []).map((i) => ({ ...i, lead: leadById.get(i.lead_id) ?? null }));
  return NextResponse.json({ session, queue });
}
