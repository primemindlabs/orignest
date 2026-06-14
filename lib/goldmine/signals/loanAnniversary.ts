/** Goldmine signal — 1/3/5-year funding anniversary approaching (relationship touch). */
import 'server-only';
import type { GoldmineCandidate } from '../types';
import { fullName, type GoldmineContext } from '../context';
import { buildDraft } from '../draftMessages';
import { getLoanAnniversary } from '../estimate';

export function loanAnniversary(ctx: GoldmineContext): GoldmineCandidate[] {
  const out: GoldmineCandidate[] = [];
  for (const l of ctx.leads) {
    if (l.stage !== 'closed') continue;
    const years = getLoanAnniversary(l.closed_date);
    if (!years) continue;
    const draft = buildDraft('loan_anniversary', l.first_name ?? '', ctx.loFirstName, { years });
    out.push({
      contact_id: l.id,
      contact_name: fullName(l),
      loan_id: l.id,
      signal_type: 'loan_anniversary',
      signal_headline: `${years}-year home anniversary coming up — perfect time to reconnect`,
      signal_detail: { years, funded_date: l.closed_date },
      priority_score: 45,
      estimated_loan_amount: l.loan_amount,
      estimated_comp_dollars: null,
      draft_sms: draft.sms,
      draft_email_subject: draft.subject,
      draft_email_body: draft.body,
    });
  }
  return out;
}
