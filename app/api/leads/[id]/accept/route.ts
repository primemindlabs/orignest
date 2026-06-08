import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Phase 2.5 — POST /api/leads/[id]/accept
 * The assigned LO accepts the routed lead; the speed-to-lead clock stops.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const sb = createAdminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const profileId = profile?.id as string | undefined;
  if (!profileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data: lead } = await sb
    .from('leads')
    .select('id, assigned_to')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  if (lead.assigned_to !== profileId) {
    return NextResponse.json({ error: 'Lead is not assigned to you' }, { status: 403 });
  }

  await sb
    .from('leads')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('org_id', orgId);

  await sb.from('lead_routing_log').insert({
    org_id: orgId,
    lead_id: params.id,
    lo_id: profileId,
    event: 'accepted',
  });

  return NextResponse.json({ ok: true });
}
