/** Goldmine signal — accessible home equity crossed a threshold (HELOC / cash-out). */
import 'server-only';
import type { GoldmineCandidate } from '../types';
import { fullName, type GoldmineContext } from '../context';
import { buildDraft } from '../draftMessages';
import { estimateComp } from '../estimate';

const MIN_EQUITY = 50_000;

export function equityMilestone(ctx: GoldmineContext): GoldmineCandidate[] {
  const out: GoldmineCandidate[] = [];
  for (const rel of ctx.relationships) {
    const equity = rel.estimated_equity == null ? null : Number(rel.estimated_equity);
    if (equity == null || equity < MIN_EQUITY) continue;

    // Attribute to one of this LO's leads on the relationship (most recent wins via order).
    const lead = rel.lead_ids.map((id) => ctx.leadById.get(id)).find(Boolean);
    if (!lead) continue;

    const equityK = Math.round(equity / 1000);
    const draft = buildDraft('equity_milestone', lead.first_name ?? '', ctx.loFirstName, { equityK });
    out.push({
      contact_id: lead.id,
      contact_name: fullName(lead),
      loan_id: lead.id,
      signal_type: 'equity_milestone',
      signal_headline: `~$${equityK}K accessible equity — HELOC or cash-out candidate`,
      signal_detail: {
        estimated_equity: equity,
        last_known_avm: rel.last_known_avm,
        current_loan_balance: rel.current_loan_balance,
      },
      priority_score: 70,
      estimated_loan_amount: equity,
      estimated_comp_dollars: estimateComp(equity, ctx.compRate),
      draft_sms: draft.sms,
      draft_email_subject: draft.subject,
      draft_email_body: draft.body,
    });
  }
  return out;
}
