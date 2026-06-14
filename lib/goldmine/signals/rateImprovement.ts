/** Goldmine signal — original note rate is ≥0.5% above current market (refi candidate). */
import 'server-only';
import type { GoldmineCandidate } from '../types';
import { fullName, type GoldmineContext } from '../context';
import { buildDraft } from '../draftMessages';
import { estimateMonthlySavings, estimateComp } from '../estimate';

const MIN_DELTA = 0.5;

export function rateImprovement(ctx: GoldmineContext): GoldmineCandidate[] {
  const out: GoldmineCandidate[] = [];
  for (const l of ctx.leads) {
    if (l.stage !== 'closed' || !l.original_rate) continue;
    const delta = Number(l.original_rate) - ctx.marketRate;
    if (delta < MIN_DELTA) continue;
    const savings = estimateMonthlySavings(l.loan_amount, Number(l.original_rate), ctx.marketRate);
    const closeYear = l.closed_date ? l.closed_date.slice(0, 4) : undefined;
    const draft = buildDraft('rate_improvement', l.first_name ?? '', ctx.loFirstName, { savings, closeYear });
    out.push({
      contact_id: l.id,
      contact_name: fullName(l),
      loan_id: l.id,
      signal_type: 'rate_improvement',
      signal_headline: `Rate ${delta.toFixed(2)}% above market${savings > 0 ? ` — ~$${savings}/mo savings` : ''}`,
      signal_detail: {
        original_rate: Number(l.original_rate),
        current_market: ctx.marketRate,
        delta: Number(delta.toFixed(2)),
        estimated_monthly_savings: savings,
      },
      priority_score: Math.min(100, Math.round(50 + delta * 20)),
      estimated_loan_amount: l.loan_amount,
      estimated_comp_dollars: estimateComp(l.loan_amount, ctx.compRate),
      draft_sms: draft.sms,
      draft_email_subject: draft.subject,
      draft_email_body: draft.body,
    });
  }
  return out;
}
