/** Goldmine signal — pre-approval expired 90+ days with no close. */
import 'server-only';
import type { GoldmineCandidate } from '../types';
import { fullName, type GoldmineContext } from '../context';
import { buildDraft } from '../draftMessages';
import { estimateComp } from '../estimate';

const DAY = 86_400_000;

export function preApprovalExpired(ctx: GoldmineContext): GoldmineCandidate[] {
  const now = Date.now();
  const out: GoldmineCandidate[] = [];
  for (const l of ctx.leads) {
    if (l.stage !== 'pre_qual') continue;
    const last = l.last_contacted_at ? new Date(l.last_contacted_at).getTime() : null;
    const days = last ? Math.floor((now - last) / DAY) : null;
    if (days == null || days < 90) continue;
    const draft = buildDraft('pre_approval_expired', l.first_name ?? '', ctx.loFirstName, {});
    out.push({
      contact_id: l.id,
      contact_name: fullName(l),
      loan_id: l.id,
      signal_type: 'pre_approval_expired',
      signal_headline: `Pre-approval expired ${days} days ago — may be ready to buy`,
      signal_detail: { days_since_last_activity: days },
      priority_score: 60,
      estimated_loan_amount: l.loan_amount,
      estimated_comp_dollars: estimateComp(l.loan_amount, ctx.compRate),
      draft_sms: draft.sms,
      draft_email_subject: draft.subject,
      draft_email_body: draft.body,
    });
  }
  return out;
}
