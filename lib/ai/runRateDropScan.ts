/**
 * Phase 30.7 — scan past borrowers for refi opportunities and draft outreach.
 * Shared by the daily cron and the on-demand "Scan now" button.
 *
 * Source: borrower_relationships (rate_delta, monthly_savings_if_refi,
 * refi_alert_threshold). A draft is created when the rate drop meets the
 * borrower's alert threshold and no pending_review draft already exists.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateRateDropDraft } from '@/lib/ai/campaignDrafts';

const DEFAULT_THRESHOLD = 0.25;
const SCAN_CAP = 50;

export async function runRateDropScan(sb: SupabaseClient<any, any, any>, orgId: string): Promise<{ created: number; eligible: number }> {
  const { data: rels } = await sb
    .from('borrower_relationships')
    .select('id, full_name, email, original_rate, current_market_rate, rate_delta, monthly_savings_if_refi, refi_alert_threshold, last_known_address')
    .eq('org_id', orgId)
    .not('original_rate', 'is', null)
    .not('current_market_rate', 'is', null);

  const eligible = (rels ?? []).filter((r) => {
    const delta = r.rate_delta != null ? Number(r.rate_delta) : (Number(r.original_rate) - Number(r.current_market_rate));
    const threshold = r.refi_alert_threshold != null ? Number(r.refi_alert_threshold) : DEFAULT_THRESHOLD;
    return delta >= threshold && !!r.email;
  });
  if (eligible.length === 0) return { created: 0, eligible: 0 };

  // Skip relationships that already have a pending draft.
  const { data: existing } = await sb
    .from('campaign_drafts')
    .select('relationship_id')
    .eq('org_id', orgId)
    .eq('campaign_type', 'rate_drop')
    .eq('status', 'pending_review');
  const skip = new Set((existing ?? []).map((e) => e.relationship_id));

  let created = 0;
  for (const r of eligible) {
    if (skip.has(r.id)) continue;
    if (created >= SCAN_CAP) break;

    const firstName = (r.full_name ?? '').trim().split(/\s+/)[0] || 'there';
    const originalRate = Number(r.original_rate);
    const currentRate = Number(r.current_market_rate);
    const monthlySavings = r.monthly_savings_if_refi != null ? Number(r.monthly_savings_if_refi) : 0;

    let content;
    try {
      content = await generateRateDropDraft({ firstName, originalRate, currentRate, monthlySavings });
    } catch (err) {
      console.error('[rate-drop] draft gen failed', r.id, err);
      continue;
    }

    const { error } = await sb.from('campaign_drafts').insert({
      org_id: orgId,
      campaign_type: 'rate_drop',
      relationship_id: r.id,
      email_subject: content.email_subject,
      email_body: content.email_body,
      sms_message: content.sms_message,
      trigger_data: { rate_delta: originalRate - currentRate, original_rate: originalRate, current_rate: currentRate, monthly_savings: monthlySavings },
      status: 'pending_review',
    });
    if (!error) created += 1;
  }

  return { created, eligible: eligible.length };
}
