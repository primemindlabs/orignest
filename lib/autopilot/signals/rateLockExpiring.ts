/** Signal: an approved rate lock expires within 14 days — review extension options. */
import 'server-only';
import type { DraftAction } from '../types';
import { fullName, type SignalCtx } from '../context';

const WITHIN_DAYS = 14;

export async function detectRateLockExpiring(ctx: SignalCtx): Promise<DraftAction[]> {
  if (!ctx.leadIds.length) return [];
  const today = ctx.targetDate.toISOString().slice(0, 10);
  const horizon = new Date(ctx.targetDate.getTime() + WITHIN_DAYS * 86_400_000).toISOString().slice(0, 10);

  const { data } = await ctx.sb
    .from('rate_lock_requests')
    .select('lead_id, requested_lock_expiration')
    .eq('org_id', ctx.orgId)
    .in('lead_id', ctx.leadIds)
    .eq('status', 'approved')
    .not('requested_lock_expiration', 'is', null)
    .gte('requested_lock_expiration', today)
    .lte('requested_lock_expiration', horizon)
    .limit(100);

  const seen = new Set<string>();
  const out: DraftAction[] = [];
  for (const r of (data ?? []) as { lead_id: string; requested_lock_expiration: string }[]) {
    if (seen.has(r.lead_id)) continue;
    seen.add(r.lead_id);
    const lead = ctx.leadById.get(r.lead_id);
    if (!lead) continue;
    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(r.requested_lock_expiration + 'T00:00:00').getTime() - ctx.targetDate.getTime()) / 86_400_000),
    );
    const name = fullName(lead);
    out.push({
      action_type: 'internal_alert',
      signal_type: 'rate_lock_expiring',
      signal_reason: `The rate lock on ${name}'s file expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Review extension options now.`,
      entity_type: 'borrower',
      entity_id: lead.id,
      entity_name: name,
      loan_id: lead.id,
      priority: 1,
    });
  }
  return out;
}
