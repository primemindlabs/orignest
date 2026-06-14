/**
 * Signal: a post-close borrower hit a rate-drop or equity-gain milestone (Phase 103).
 * Surfaced as an internal alert carrying the suggested outreach so the LO can review
 * the refi/HELOC opportunity (the borrower may be a closed file — keep a human in the loop).
 */
import 'server-only';
import type { DraftAction } from '../types';
import { type SignalCtx } from '../context';

export async function detectPostCloseEquity(ctx: SignalCtx): Promise<DraftAction[]> {
  const { data } = await ctx.sb
    .from('post_close_outreach')
    .select('id, lead_id, trigger_type, outreach_message')
    .eq('org_id', ctx.orgId)
    .eq('user_id', ctx.loId)
    .eq('status', 'queued')
    .in('trigger_type', ['rate_drop', 'equity_gain'])
    .limit(50);

  const out: DraftAction[] = [];
  for (const r of (data ?? []) as { id: string; lead_id: string | null; trigger_type: string; outreach_message: string | null }[]) {
    const lead = r.lead_id ? ctx.leadById.get(r.lead_id) : undefined;
    const name = lead ? `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'A past borrower' : 'A past borrower';
    const headline = r.trigger_type === 'rate_drop' ? 'Rates have dropped enough to refi' : 'Home equity has grown';
    out.push({
      action_type: 'internal_alert',
      signal_type: 'post_close_equity',
      signal_reason: `${headline} for ${name}. Review the refi/HELOC opportunity and reach out.`,
      recommended_content: r.outreach_message,
      entity_type: 'borrower',
      entity_id: r.lead_id ?? r.id,
      entity_name: name,
      loan_id: r.lead_id,
      priority: 5,
    });
  }
  return out;
}
