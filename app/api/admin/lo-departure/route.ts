/**
 * Phase 31.4a — LO departure: reassign a departing LO's active loans to another
 * LO in the SAME org and log it (admin / branch manager only). Loans never leave
 * the org; portal tokens stay valid (tied to lead_id), so chat threads continue.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { permissionsFor } from '@/lib/permissions/accessMatrix';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });
  if (!permissionsFor(role).manage_team) return NextResponse.json({ error: 'Forbidden — manager access required' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { lo_user_id?: string; reassign_to?: string };
  if (!body.lo_user_id || !body.reassign_to) return NextResponse.json({ error: 'lo_user_id and reassign_to are required' }, { status: 400 });

  const sb = createAdminClient();
  // Both profiles must belong to this org.
  const { data: profiles } = await sb.from('profiles').select('id').eq('org_id', orgId).in('id', [body.lo_user_id, body.reassign_to]);
  if ((profiles ?? []).length !== 2) return NextResponse.json({ error: 'Both LOs must be in your organization.' }, { status: 400 });

  const { data: active } = await sb.from('leads').select('id').eq('org_id', orgId).eq('assigned_to', body.lo_user_id).in('stage', ACTIVE_STAGES).is('archived_at', null);
  const leadIds = (active ?? []).map((l) => l.id);

  if (leadIds.length > 0) {
    await sb.from('leads').update({ assigned_to: body.reassign_to }).in('id', leadIds);
    // Keep chat threads' lo_id in sync.
    await sb.from('loan_chat_threads').update({ lo_id: body.reassign_to }).in('lead_id', leadIds).eq('org_id', orgId).then(() => undefined, () => undefined);
  }

  await sb.from('lo_departure_log').insert({ org_id: orgId, lo_user_id: body.lo_user_id, loans_reassigned_to: body.reassign_to, loan_count: leadIds.length });

  return NextResponse.json({ ok: true, reassigned: leadIds.length });
}
