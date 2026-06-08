import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { routeLead } from '@/lib/routing/routeLead';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_REASONS = ['wrong_territory', 'over_capacity', 'conflict_of_interest', 'other'];

/**
 * Phase 2.5 — POST /api/leads/[id]/reject  Body: { reason }
 * Returns the lead to the routing pool and re-routes it. Three rejections by the
 * same LO in 24h raises a manager alert. The no-response (60s timeout) path is
 * handled by the speed-to-contact monitor, not this route.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const reason = body?.reason && VALID_REASONS.includes(body.reason) ? body.reason : 'other';

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

  // Log the rejection, release the lead, and re-route to the pool.
  await sb.from('lead_routing_log').insert({
    org_id: orgId,
    lead_id: params.id,
    lo_id: profileId,
    event: 'rejected',
    reason,
  });
  await sb
    .from('leads')
    .update({ assigned_to: null, accepted_at: null })
    .eq('id', params.id)
    .eq('org_id', orgId);

  const result = await routeLead({ orgId, leadId: params.id });

  // Three rejections by this LO in 24h → manager alert.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb
    .from('lead_routing_log')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('lo_id', profileId)
    .eq('event', 'rejected')
    .gte('created_at', since);

  if ((count ?? 0) >= 3) {
    await sb.from('lead_activities').insert({
      lead_id: params.id,
      org_id: orgId,
      action: 'rejection_threshold_alert',
      description: `LO reached ${count} lead rejections in 24h — manager review suggested`,
      metadata: { lo_id: profileId, rejections_24h: count, agent: 'routing' },
    });
  }

  return NextResponse.json({ ok: true, rerouted: result });
}
