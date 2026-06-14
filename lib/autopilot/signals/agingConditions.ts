/** Signal: a borrower condition has been outstanding 5+ days with no response. */
import 'server-only';
import type { DraftAction } from '../types';
import { fullName, type SignalCtx } from '../context';
import { draftConditionFollowup } from '../drafts';

const MIN_AGE_DAYS = 5;

export async function detectAgingConditions(ctx: SignalCtx): Promise<DraftAction[]> {
  if (!ctx.leadIds.length) return [];
  const cutoff = new Date(ctx.targetDate.getTime() - MIN_AGE_DAYS * 86_400_000).toISOString();

  const { data } = await ctx.sb
    .from('loan_conditions')
    .select('id, lead_id, condition_text, status, created_at')
    .eq('org_id', ctx.orgId)
    .in('lead_id', ctx.leadIds)
    .eq('status', 'issued') // 'issued' = still waiting on the borrower (submitted/received = they responded)
    .lte('created_at', cutoff)
    .limit(200);

  const out: DraftAction[] = [];
  for (const c of (data ?? []) as { id: string; lead_id: string; condition_text: string; created_at: string }[]) {
    const lead = ctx.leadById.get(c.lead_id);
    if (!lead) continue;
    const ageDays = Math.floor((ctx.targetDate.getTime() - new Date(c.created_at).getTime()) / 86_400_000);
    const name = fullName(lead);
    out.push({
      action_type: 'send_sms',
      signal_type: 'condition_aging',
      signal_reason: `${name} hasn't submitted their "${c.condition_text}" in ${ageDays} days. The loan could stall without it.`,
      recommended_content: await draftConditionFollowup(ctx.sb, ctx.loId, lead.id, lead.first_name, name, c.condition_text),
      entity_type: 'borrower',
      entity_id: lead.id,
      entity_name: name,
      loan_id: lead.id,
      priority: 2,
    });
  }
  return out;
}
