import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateStageTransitions } from '@/lib/leads/stageTransitions';
import { applyConditionTemplates } from '@/lib/conditions/templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Recognized qualifying events that can drive stage automation (Phase 1.1).
const KNOWN_EVENTS = new Set([
  'application_submitted',
  'soft_pull_completed',
  'conditions_cleared',
  'loan_submitted_to_uw',
  'loan_approved',
  'rate_locked',
  'cd_sent',
  'closed',
  'loan_type_set',
]);

/**
 * POST /api/leads/[id]/events
 * Body: { event_type, metadata? }
 * Logs the event, evaluates stage-transition rules, and (on loan_type_set /
 * application_submitted) seeds program condition templates if not already present.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No organization context' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { event_type?: string; metadata?: Record<string, unknown> }
    | null;
  const eventType = body?.event_type;
  if (!eventType) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const leadId = params.id;

  const { data: lead } = await sb
    .from('leads')
    .select('id, loan_type')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const actorId = (profile?.id as string | undefined) ?? null;

  // 1. Record the event on the timeline.
  await sb.from('lead_activities').insert({
    lead_id: leadId,
    org_id: orgId,
    actor_id: actorId,
    action: `event:${eventType}`,
    description: `Event: ${eventType.replace(/_/g, ' ')}`,
    metadata: { ...(body?.metadata ?? {}), event_type: eventType },
  });

  // 2. Seed condition templates when the program is established.
  let conditionsSeeded = 0;
  if (eventType === 'loan_type_set' || eventType === 'application_submitted') {
    const loanType =
      (body?.metadata?.loan_type as string | undefined) ?? (lead.loan_type as string | null);
    const { added } = await applyConditionTemplates({ orgId, leadId, loanType });
    conditionsSeeded = added;
  }

  // 3. Evaluate stage automation.
  const transition = KNOWN_EVENTS.has(eventType)
    ? await evaluateStageTransitions({ orgId, leadId, triggerEvent: eventType, actorId })
    : { transitioned: false };

  return NextResponse.json({ ok: true, transition, conditionsSeeded });
}
