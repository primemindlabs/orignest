/**
 * Signal: a referral realtor's heat score is in the "cooling" band — reach out.
 * Realtors aren't lead-keyed, so canSendSMS() (which is borrower/lead-keyed) can't
 * gate them; we recommend EMAIL (CAN-SPAM compliant) rather than SMS.
 */
import 'server-only';
import type { DraftAction } from '../types';
import type { SignalCtx } from '../context';
import { draftRealtorCheckin } from '../drafts';

type HeatRow = {
  realtor_id: string;
  band: string;
  days_since_last_contact: number | null;
  realtors: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

export async function detectCoolingRealtors(ctx: SignalCtx): Promise<DraftAction[]> {
  if (!ctx.realtorIds.length) return [];

  const { data } = await ctx.sb
    .from('realtor_heat_scores')
    .select('realtor_id, band, days_since_last_contact, realtors!inner(first_name, last_name, email)')
    .eq('org_id', ctx.orgId)
    .in('realtor_id', ctx.realtorIds)
    .eq('band', 'cooling')
    .limit(50);

  const out: DraftAction[] = [];
  for (const row of (data ?? []) as unknown as HeatRow[]) {
    const r = row.realtors;
    if (!r) continue;
    const name = `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() || 'your partner';
    const since = row.days_since_last_contact;
    const sinceLabel = since == null ? 'a while ago' : `${since} days ago`;
    out.push({
      action_type: 'send_email',
      signal_type: 'heat_score_drop',
      signal_reason: `${name}'s referral relationship is cooling — last contact was ${sinceLabel}. A quick check-in keeps the pipeline warm.`,
      recommended_subject: 'Checking in',
      recommended_content: await draftRealtorCheckin(ctx.sb, ctx.loId, row.realtor_id, r.first_name, name),
      entity_type: 'realtor',
      entity_id: row.realtor_id,
      entity_name: name,
      priority: 4,
    });
  }
  return out;
}
