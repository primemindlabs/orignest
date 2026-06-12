// Phase 103 — nightly post-close trigger detection for one org. Reads the live 30yr
// market rate (market_rate_snapshots), scans active borrower_relationships, and drafts
// rate-drop + equity-gain outreach into the post_close_outreach review queue.
//
// Anniversary is intentionally NOT detected here — Phase 102 owns it. Everything drafted
// requires LO review before sending (review-only mode); rate-drop never auto-sends.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildRateDropMessage, buildEquityMessage, firstNameOf } from './triggerMessages';

type Admin = SupabaseClient<any, any, any>;
const DAY = 86_400_000;
const RATE_DEDUP_DAYS = 90;
const EQUITY_DEDUP_DAYS = 180;
const EQUITY_PCT_MIN = 0.2; // >= 20% equity
const EQUITY_LTV_MAX = 0.8; // <= 80% LTV

export async function detectPostCloseTriggers(
  sb: Admin,
  orgId: string,
  now: Date = new Date()
): Promise<{ created: number; eligible: number }> {
  // Live 30yr rate (most recent snapshot).
  const { data: rateRow } = await sb
    .from('market_rate_snapshots')
    .select('rate, snapshot_date')
    .eq('product', '30yr_fixed')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const market30 = rateRow ? Number(rateRow.rate) : null;

  // Representative org sender (LO name + phone) — relationships aren't per-LO.
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, first_name, last_name, phone, role, active')
    .eq('org_id', orgId);
  const sender =
    (profiles ?? []).find((p) => p.active && (p.role === 'loan_officer' || p.role === 'admin')) ??
    (profiles ?? [])[0] ??
    null;
  const loName = sender
    ? `${sender.first_name ?? ''} ${sender.last_name ?? ''}`.trim() || 'Your Loan Officer'
    : 'Your Loan Officer';
  const loPhone = (sender?.phone as string | null) ?? '';

  const { data: monitors } = await sb
    .from('borrower_relationships')
    .select(
      'id, full_name, phone, lead_ids, original_rate, current_market_rate, refi_alert_threshold, last_known_avm, current_loan_balance, estimated_equity'
    )
    .eq('org_id', orgId)
    .eq('monitoring_status', 'active');

  let created = 0;
  let eligible = 0;

  for (const m of monitors ?? []) {
    const relId = m.id as string;
    const firstName = firstNameOf(m.full_name as string);
    const leadId = Array.isArray(m.lead_ids) && m.lead_ids.length ? (m.lead_ids[0] as string) : null;

    // ── Rate drop ─────────────────────────────────────────────────────────────
    const origRate = m.original_rate != null ? Number(m.original_rate) : null;
    const current = market30 ?? (m.current_market_rate != null ? Number(m.current_market_rate) : null);
    const threshold = m.refi_alert_threshold != null ? Number(m.refi_alert_threshold) : 0.75;
    if (origRate != null && current != null && origRate - current >= threshold) {
      eligible++;
      const recent = await hasRecent(sb, relId, 'rate_drop', now, RATE_DEDUP_DAYS);
      if (!recent) {
        const { error } = await sb.from('post_close_outreach').insert({
          org_id: orgId,
          user_id: sender?.id ?? null,
          relationship_id: relId,
          lead_id: leadId,
          trigger_type: 'rate_drop',
          trigger_details: {
            original_rate: origRate,
            current_market_rate: current,
            rate_delta: Math.round((origRate - current) * 1000) / 1000,
          },
          outreach_message: buildRateDropMessage({ first_name: firstName, lo_name: loName, lo_phone: loPhone }),
          channel: 'sms',
          requires_review: true,
        });
        if (!error) created++;
      }
    }

    // ── Equity gain ───────────────────────────────────────────────────────────
    const avm = m.last_known_avm != null ? Number(m.last_known_avm) : null;
    const equity = m.estimated_equity != null ? Number(m.estimated_equity) : null;
    const balance = m.current_loan_balance != null ? Number(m.current_loan_balance) : null;
    if (avm && avm > 0 && equity != null) {
      const equityPct = equity / avm;
      const ltv = balance != null ? balance / avm : 1 - equityPct;
      if (equityPct >= EQUITY_PCT_MIN && ltv <= EQUITY_LTV_MAX) {
        eligible++;
        const recent = await hasRecent(sb, relId, 'equity_gain', now, EQUITY_DEDUP_DAYS);
        if (!recent) {
          const { error } = await sb.from('post_close_outreach').insert({
            org_id: orgId,
            user_id: sender?.id ?? null,
            relationship_id: relId,
            lead_id: leadId,
            trigger_type: 'equity_gain',
            trigger_details: {
              estimated_equity: equity,
              estimated_ltv: Math.round(ltv * 10000) / 10000,
              estimated_value: avm,
            },
            outreach_message: buildEquityMessage({ first_name: firstName, lo_name: loName, lo_phone: loPhone }),
            channel: 'sms',
            requires_review: true,
          });
          if (!error) created++;
        }
      }
    }
  }

  return { created, eligible };
}

async function hasRecent(
  sb: Admin,
  relationshipId: string,
  triggerType: string,
  now: Date,
  days: number
): Promise<boolean> {
  const since = new Date(now.getTime() - days * DAY).toISOString();
  const { data } = await sb
    .from('post_close_outreach')
    .select('id')
    .eq('relationship_id', relationshipId)
    .eq('trigger_type', triggerType)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle();
  return !!data;
}
