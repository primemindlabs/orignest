/**
 * Phase 1.1 — Automated stage progression (server-only)
 *
 * Given a qualifying event on a lead, look up matching stage_transition_rules
 * (org-specific first, else platform default) and advance the lead's stage.
 * stage_changed_at is maintained by a DB trigger, so we only set `stage`.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export interface StageTransitionResult {
  transitioned: boolean;
  from?: string;
  to?: string;
  triggerEvent?: string;
}

export async function evaluateStageTransitions(params: {
  orgId: string;
  leadId: string;
  triggerEvent: string;
  actorId?: string | null;
}): Promise<StageTransitionResult> {
  const { orgId, leadId, triggerEvent, actorId = null } = params;
  const sb = createAdminClient();

  const { data: lead } = await sb
    .from('leads')
    .select('id, stage, assigned_to')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return { transitioned: false };

  const { data: rules } = await sb
    .from('stage_transition_rules')
    .select('from_stage, to_stage, org_id')
    .eq('trigger_event', triggerEvent)
    .eq('is_active', true)
    .eq('from_stage', lead.stage)
    .or(`org_id.eq.${orgId},org_id.is.null`);

  if (!rules || rules.length === 0) return { transitioned: false };

  // Org-specific rule wins over the platform default.
  const rule =
    rules.find((r: { org_id: string | null }) => r.org_id === orgId) ?? rules[0];
  const to = rule.to_stage as string;
  if (to === lead.stage) return { transitioned: false };

  await sb
    .from('leads')
    .update({ stage: to, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .eq('org_id', orgId);

  await sb.from('lead_activities').insert({
    lead_id: leadId,
    org_id: orgId,
    actor_id: actorId,
    action: 'stage_auto_advanced',
    description: `Stage auto-advanced ${lead.stage} → ${to}`,
    metadata: { from: lead.stage, to, triggerEvent, agent: 'stage_automation' },
  });

  // Phase 46.7 — proactively notify the referring realtor (best-effort; never
  // blocks the transition). Dedup + Twilio-gating handled inside.
  try {
    const { notifyRealtorOfStage } = await import('@/lib/realtors/notifications');
    await notifyRealtorOfStage(leadId, to, orgId);
  } catch {
    /* notifications are best-effort */
  }

  // Phase 129 — a stage change moves File Intelligence (close prob, predicted
  // close, etc.). Best-effort; never blocks the transition.
  try {
    const { recalculateLoanIntelligence } = await import('@/lib/intelligence/recalculateLoanIntelligence');
    await recalculateLoanIntelligence(sb, leadId, 'stage_change');
  } catch {
    /* intelligence recalc is best-effort */
  }

  // Phase 99 — append the immutable funnel audit row. Best-effort.
  const { logStageTransition } = await import('@/lib/funnel/logTransition');
  await logStageTransition(sb, {
    orgId, leadId,
    loId: (lead.assigned_to as string | null) ?? null,
    fromStage: lead.stage as string,
    toStage: to,
  });

  return { transitioned: true, from: lead.stage as string, to, triggerEvent };
}
