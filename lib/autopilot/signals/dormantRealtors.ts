/** Signal: a referral realtor has had no logged interaction in 30+ days. */
import 'server-only';
import type { DraftAction } from '../types';
import type { SignalCtx } from '../context';
import { draftRealtorCheckin } from '../drafts';

const DORMANT_DAYS = 30;

export async function detectDormantRealtors(ctx: SignalCtx): Promise<DraftAction[]> {
  if (!ctx.realtorIds.length) return [];
  const cutoff = new Date(ctx.targetDate.getTime() - DORMANT_DAYS * 86_400_000).toISOString();

  const { data } = await ctx.sb
    .from('realtors')
    .select('id, first_name, last_name, email, last_contact_at, is_archived')
    .eq('org_id', ctx.orgId)
    .in('id', ctx.realtorIds)
    .or(`last_contact_at.is.null,last_contact_at.lte.${cutoff}`)
    .limit(50);

  const out: DraftAction[] = [];
  for (const r of (data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; is_archived: boolean | null }[]) {
    if (r.is_archived) continue;
    const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'your partner';
    out.push({
      action_type: 'send_email',
      signal_type: 'realtor_dormant',
      signal_reason: `No contact with ${name} in over ${DORMANT_DAYS} days. Worth a quick touch to stay top of mind.`,
      recommended_subject: 'Checking in',
      recommended_content: await draftRealtorCheckin(ctx.sb, ctx.loId, r.id, r.first_name, name),
      entity_type: 'realtor',
      entity_id: r.id,
      entity_name: name,
      priority: 7,
    });
  }
  return out;
}
