/**
 * Signal: an active file has a close probability under 30% — alert the LO to review.
 * Uses Phase 83 loan_probability_scores (score is 0–100, so < 30 ≈ < 0.30 close prob).
 */
import 'server-only';
import type { DraftAction } from '../types';
import { fullName, TERMINAL_STAGES, type SignalCtx } from '../context';

const MAX_SCORE = 30;

export async function detectFalloutRisk(ctx: SignalCtx): Promise<DraftAction[]> {
  if (!ctx.leadIds.length) return [];

  const { data } = await ctx.sb
    .from('loan_probability_scores')
    .select('lead_id, score')
    .eq('org_id', ctx.orgId)
    .in('lead_id', ctx.leadIds)
    .lt('score', MAX_SCORE)
    .limit(100);

  const out: DraftAction[] = [];
  for (const s of (data ?? []) as { lead_id: string; score: number }[]) {
    const lead = ctx.leadById.get(s.lead_id);
    if (!lead) continue;
    if (lead.stage && TERMINAL_STAGES.has(lead.stage)) continue; // closed/lost files aren't at risk
    const name = fullName(lead);
    out.push({
      action_type: 'internal_alert',
      signal_type: 'fallout_risk',
      signal_reason: `${name}'s file has a ${Math.round(s.score)}% close probability. Review conditions and remove blockers before it falls out.`,
      entity_type: 'borrower',
      entity_id: lead.id,
      entity_name: name,
      loan_id: lead.id,
      priority: 1,
    });
  }
  return out;
}
