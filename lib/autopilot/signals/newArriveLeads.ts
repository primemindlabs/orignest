/** Signal: a new Arrive (Phase 94) referral has had zero contact in over an hour. */
import 'server-only';
import type { DraftAction } from '../types';
import { fullName, type SignalCtx } from '../context';

const NEW_WINDOW_HOURS = 24;

export async function detectNewArriveLeads(ctx: SignalCtx): Promise<DraftAction[]> {
  const windowStart = ctx.targetDate.getTime() - NEW_WINDOW_HOURS * 3_600_000;
  const out: DraftAction[] = [];
  for (const lead of ctx.leads) {
    // Phase 94 tags Arrive imports via leads.lead_source = 'arrive' (NOT referral_source).
    const source = lead.lead_source ?? lead.referral_source ?? '';
    if (!/arrive/i.test(source)) continue;
    if (lead.last_contacted_at) continue; // already contacted
    if (new Date(lead.created_at).getTime() < windowStart) continue; // not "new"
    const name = fullName(lead);
    out.push({
      action_type: 'internal_alert',
      signal_type: 'new_arrive_lead',
      signal_reason: `New Arrive referral ${name} hasn't been contacted yet. Speed-to-lead matters — reach out now.`,
      entity_type: 'borrower',
      entity_id: lead.id,
      entity_name: name,
      loan_id: lead.id,
      priority: 1,
    });
  }
  return out;
}
