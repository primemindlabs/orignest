/** Goldmine signal — Cold heat band + 12+ months with no contact (reconnect). */
import 'server-only';
import type { GoldmineCandidate } from '../types';
import { fullName, type GoldmineContext } from '../context';
import { buildDraft } from '../draftMessages';

const MIN_DAYS = 365;

export function longInactive(ctx: GoldmineContext): GoldmineCandidate[] {
  const out: GoldmineCandidate[] = [];
  for (const l of ctx.leads) {
    const heat = ctx.heatByLead.get(l.id);
    if (!heat || heat.band !== 'cold') continue;
    const days = heat.days_since_last_contact;
    if (days == null || days < MIN_DAYS) continue;
    const months = Math.round(days / 30);
    const draft = buildDraft('long_inactive', l.first_name ?? '', ctx.loFirstName, { months });
    out.push({
      contact_id: l.id,
      contact_name: fullName(l),
      loan_id: l.id,
      signal_type: 'long_inactive',
      signal_headline: `${months} months with no contact — reconnect before they forget you`,
      signal_detail: { days_since_last_contact: days, heat_band: heat.band },
      priority_score: 35,
      estimated_loan_amount: l.loan_amount,
      estimated_comp_dollars: null,
      draft_sms: draft.sms,
      draft_email_subject: draft.subject,
      draft_email_body: draft.body,
    });
  }
  return out;
}
