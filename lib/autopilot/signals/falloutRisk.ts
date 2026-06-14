/**
 * Signal: an active file has a close probability under 30% — alert the LO to review.
 * Reads Phase 129's unified File Intelligence model (loan_intelligence_scores), so
 * Autopilot and the in-file Intelligence panel share one risk source. close_probability
 * is a 0.0–1.0 float; fallout_flags carries the specific active risks.
 */
import 'server-only';
import type { DraftAction } from '../types';
import { fullName, TERMINAL_STAGES, type SignalCtx } from '../context';

const MAX_CLOSE_PROBABILITY = 0.3;

type IntelRow = {
  loan_id: string;
  close_probability: number | null;
  fallout_flags: { description?: string }[] | null;
};

export async function detectFalloutRisk(ctx: SignalCtx): Promise<DraftAction[]> {
  if (!ctx.leadIds.length) return [];

  const { data } = await ctx.sb
    .from('loan_intelligence_scores')
    .select('loan_id, close_probability, fallout_flags')
    .eq('org_id', ctx.orgId)
    .in('loan_id', ctx.leadIds)
    .lt('close_probability', MAX_CLOSE_PROBABILITY)
    .limit(100);

  const out: DraftAction[] = [];
  for (const s of (data ?? []) as IntelRow[]) {
    const lead = ctx.leadById.get(s.loan_id);
    if (!lead) continue;
    if (lead.stage && TERMINAL_STAGES.has(lead.stage)) continue; // closed/denied files aren't at risk
    const name = fullName(lead);
    const pct = Math.round((s.close_probability ?? 0) * 100);
    const riskCount = Array.isArray(s.fallout_flags) ? s.fallout_flags.length : 0;
    const riskNote = riskCount > 0 ? ` ${riskCount} active risk${riskCount === 1 ? '' : 's'} flagged.` : '';
    out.push({
      action_type: 'internal_alert',
      signal_type: 'fallout_risk',
      signal_reason: `${name}'s file has a ${pct}% close probability.${riskNote} Review conditions and remove blockers before it falls out.`,
      entity_type: 'borrower',
      entity_id: lead.id,
      entity_name: name,
      loan_id: lead.id,
      priority: 1,
    });
  }
  return out;
}
