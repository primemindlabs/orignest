/**
 * Autopilot signal — high-value Database Goldmine™ opportunities (Phase 131).
 * Surfaces up to 2 of the LO's highest-priority surfaced opportunities into the
 * daily queue with their pre-written outreach.
 */
import 'server-only';
import type { DraftAction } from '../types';
import type { SignalCtx } from '../context';
import { canSendSMS } from '@/lib/communications/canSendSMS';

const MIN_PRIORITY = 70;
const MAX_GOLDMINE = 2;

type Opp = {
  contact_id: string;
  contact_name: string;
  signal_headline: string;
  draft_sms: string | null;
  draft_email_subject: string | null;
  draft_email_body: string | null;
};

export async function detectGoldmine(ctx: SignalCtx): Promise<DraftAction[]> {
  const { data } = await ctx.sb
    .from('goldmine_opportunities')
    .select('contact_id, contact_name, signal_headline, draft_sms, draft_email_subject, draft_email_body')
    .eq('lo_id', ctx.loId)
    .eq('status', 'surfaced')
    .gte('priority_score', MIN_PRIORITY)
    .order('priority_score', { ascending: false })
    .limit(MAX_GOLDMINE);

  const out: DraftAction[] = [];
  for (const opp of (data ?? []) as Opp[]) {
    const gate = await canSendSMS(ctx.sb, { orgId: ctx.orgId, leadId: opp.contact_id, category: 'marketing' });
    const useSms = gate.allowed && !!opp.draft_sms;
    out.push({
      action_type: useSms ? 'send_sms' : 'send_email',
      signal_type: 'goldmine',
      signal_reason: `Reactivation opportunity — ${opp.signal_headline}`,
      recommended_content: useSms ? opp.draft_sms : opp.draft_email_body,
      recommended_subject: useSms ? null : opp.draft_email_subject,
      entity_type: 'borrower',
      entity_id: opp.contact_id,
      entity_name: opp.contact_name,
      loan_id: ctx.leadById.get(opp.contact_id) ? opp.contact_id : null,
      priority: 3,
    });
  }
  return out;
}
