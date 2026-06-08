/**
 * Phase 2.1/2.2 — Capacity-aware lead routing (server-only)
 *
 * Picks the best-fit loan officer for a new lead: skips paused LOs and LOs at
 * capacity, then weights by load (active leads ÷ routing_weight) so higher-weight
 * / better-responding LOs receive proportionally more. If every LO is at capacity,
 * the lead overflows to a branch manager. All outcomes are logged to
 * lead_routing_log.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateTimeRules } from '@/lib/routing/timeRules';

const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing'];
const LO_ROLES = ['loan_officer', 'lo'];
const MANAGER_ROLES = ['manager', 'branch_manager', 'admin', 'owner'];

export interface RouteResult {
  assignedTo: string | null;
  overflow: boolean;
  reason: string;
  /** set when a time rule diverted the lead instead of assigning an LO */
  heldForBusinessHours?: boolean;
  sentToPrequalifier?: boolean;
}

export async function routeLead(params: {
  orgId: string;
  leadId: string;
}): Promise<RouteResult> {
  const { orgId, leadId } = params;
  const sb = createAdminClient();

  // ── 2.3 — time-of-day rules can divert before normal assignment ─────────────
  const timeRule = await evaluateTimeRules(orgId);
  if (timeRule.action === 'hold_for_business_hours') {
    await sb.from('lead_routing_log').insert({
      org_id: orgId, lead_id: leadId, lo_id: null, event: 'routed', reason: 'held_for_business_hours',
    });
    return { assignedTo: null, overflow: false, reason: 'held_for_business_hours', heldForBusinessHours: true };
  }
  if (timeRule.action === 'send_to_ai_prequalifier') {
    await sb.from('lead_routing_log').insert({
      org_id: orgId, lead_id: leadId, lo_id: null, event: 'routed', reason: 'sent_to_ai_prequalifier',
    });
    return { assignedTo: null, overflow: false, reason: 'sent_to_ai_prequalifier', sentToPrequalifier: true };
  }
  if (timeRule.action === 'route_to_backup' && timeRule.backupLoId) {
    await sb
      .from('leads')
      .update({ assigned_to: timeRule.backupLoId, routed_at: new Date().toISOString(), accepted_at: null })
      .eq('id', leadId)
      .eq('org_id', orgId);
    await sb.from('lead_routing_log').insert({
      org_id: orgId, lead_id: leadId, lo_id: timeRule.backupLoId, event: 'routed', reason: 'route_to_backup',
    });
    return { assignedTo: timeRule.backupLoId, overflow: false, reason: 'route_to_backup' };
  }

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, role, active')
    .eq('org_id', orgId)
    .eq('active', true);

  const los = (profiles ?? []).filter((p: { role: string }) => LO_ROLES.includes(p.role));
  const managers = (profiles ?? []).filter((p: { role: string }) => MANAGER_ROLES.includes(p.role));

  const [{ data: configs }, { data: activeLeads }] = await Promise.all([
    sb.from('lo_routing_config').select('lo_id, max_active_leads, routing_paused, routing_weight').eq('org_id', orgId),
    sb.from('leads').select('assigned_to').eq('org_id', orgId).is('archived_at', null).in('stage', ACTIVE_STAGES),
  ]);

  const configByLo = new Map<string, { max: number; paused: boolean; weight: number }>();
  for (const c of configs ?? []) {
    configByLo.set(c.lo_id, { max: c.max_active_leads, paused: c.routing_paused, weight: c.routing_weight });
  }
  const loadByLo = new Map<string, number>();
  for (const l of activeLeads ?? []) {
    if (l.assigned_to) loadByLo.set(l.assigned_to, (loadByLo.get(l.assigned_to) ?? 0) + 1);
  }

  // Eligible = not paused and under capacity; rank by load ÷ weight (lower is better).
  const eligible = los
    .map((lo: { id: string }) => {
      const cfg = configByLo.get(lo.id) ?? { max: 50, paused: false, weight: 10 };
      const load = loadByLo.get(lo.id) ?? 0;
      return { id: lo.id, cfg, load, ratio: load / Math.max(cfg.weight, 1) };
    })
    .filter((x: { cfg: { paused: boolean; max: number }; load: number }) => !x.cfg.paused && x.load < x.cfg.max)
    .sort((a: { ratio: number; load: number }, b: { ratio: number; load: number }) => a.ratio - b.ratio || a.load - b.load);

  let assignedTo: string | null = null;
  let overflow = false;
  let reason = '';

  if (eligible.length > 0) {
    assignedTo = eligible[0].id;
    reason = 'capacity_aware';
  } else if (managers.length > 0) {
    // Overflow: round-robin-ish — least-loaded manager.
    const rankedMgr = managers
      .map((m: { id: string }) => ({ id: m.id, load: loadByLo.get(m.id) ?? 0 }))
      .sort((a: { load: number }, b: { load: number }) => a.load - b.load);
    assignedTo = rankedMgr[0].id;
    overflow = true;
    reason = 'overflow_to_manager';
  } else {
    reason = 'no_eligible_recipient';
  }

  if (assignedTo) {
    await sb
      .from('leads')
      .update({ assigned_to: assignedTo, routed_at: new Date().toISOString(), accepted_at: null })
      .eq('id', leadId)
      .eq('org_id', orgId);
  }

  await sb.from('lead_routing_log').insert({
    org_id: orgId,
    lead_id: leadId,
    lo_id: assignedTo,
    event: overflow ? 'overflow' : 'routed',
    reason,
  });

  return { assignedTo, overflow, reason };
}
