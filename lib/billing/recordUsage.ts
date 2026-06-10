/**
 * Phase 67 — usage metering with the automated/manual split. SERVER-ONLY.
 *
 * AUTOMATED events (platform-fired: speed-to-lead, TRID reminders, ARM alerts, NPS,
 * status texts) ALWAYS bill to 'platform_automation' and NEVER count against an LO's
 * bundle — no exceptions. MANUAL events (LO sent it from the inbox/dialer) follow the
 * org's seat_billing_mode and consume the per-seat bundle before overage.
 *
 * Writes to the INSERT-only usage_events ledger. Stripe meter emission is GATED
 * (only when usage billing is enabled, meter IDs are set, and it's an overage).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';

export interface RecordUsageOptions {
  orgId: string; userId: string; loanId?: string;
  eventType: 'sms_sent' | 'sms_received' | 'call_outbound_min' | 'call_inbound_min' | 'email_sent' | 'voicemail_drop';
  quantity: number; // SMS: 1/message; voice: seconds
  source: 'manual' | 'automated';
  automationTrigger?: string; twilioSid?: string;
}

export async function recordUsageEvent(opts: RecordUsageOptions): Promise<void> {
  const sb = createAdminClient();

  // ── AUTOMATED: always platform_automation; never an LO charge. ──────────────
  if (opts.source === 'automated') {
    await sb.from('usage_events').insert({
      org_id: opts.orgId, user_id: opts.userId, loan_id: opts.loanId ?? null,
      event_type: opts.eventType, quantity: opts.quantity, source: 'automated', billed_to: 'platform_automation',
      automation_trigger: opts.automationTrigger ?? null, is_included_in_bundle: true, is_overage: false, twilio_sid: opts.twilioSid ?? null,
    });
    return;
  }

  // ── MANUAL: follow org billing mode + bundle/overage. ───────────────────────
  const { data: org } = await sb.from('organizations').select('seat_billing_mode, usage_billing_enabled, usage_responsibility, included_sms_per_seat, included_voice_minutes_per_seat, overage_sms_price_cents, overage_voice_price_cents').eq('id', opts.orgId).maybeSingle();
  if (!org) return;

  let billedTo: 'branch' | 'lo' = 'branch';
  if (org.usage_billing_enabled) {
    billedTo = org.seat_billing_mode === 'lo_pays_seat' || org.seat_billing_mode === 'branch_pays_seat_lo_pays_usage' ? 'lo' : (org.usage_responsibility as 'branch' | 'lo');
  }

  const { data: lob } = await sb.from('lo_billing').select('*').eq('user_id', opts.userId).maybeSingle();
  if (lob?.branch_covers_usage) billedTo = 'branch';

  const isSMS = opts.eventType === 'sms_sent' || opts.eventType === 'sms_received';
  const isVoice = opts.eventType.startsWith('call_');
  let isOverage = false; let overageCents = 0;
  if (billedTo === 'lo' && lob) {
    if (isSMS) { isOverage = (lob.current_period_sms_count ?? 0) >= org.included_sms_per_seat; if (isOverage) overageCents = org.overage_sms_price_cents * opts.quantity; }
    else if (isVoice) { const mins = Math.ceil((lob.current_period_voice_seconds ?? 0) / 60); isOverage = mins >= org.included_voice_minutes_per_seat; if (isOverage) overageCents = org.overage_voice_price_cents * Math.ceil(opts.quantity / 60); }
  }

  // Stripe meter emission FIRST (GATED) so the ledger row is written ONCE with the
  // meter id — usage_events is INSERT-only (no post-insert UPDATE).
  let meterEventId: string | null = null;
  if (isOverage && org.usage_billing_enabled) {
    const meterId = isSMS ? process.env.STRIPE_SMS_METER_ID : process.env.STRIPE_VOICE_METER_ID;
    if (process.env.STRIPE_SECRET_KEY && meterId) {
      let customerId: string | null = null;
      try {
        if (billedTo === 'lo' && lob?.stripe_customer_id_enc) customerId = decrypt(lob.stripe_customer_id_enc);
        else { const { data: o } = await sb.from('organizations').select('stripe_customer_id').eq('id', opts.orgId).maybeSingle(); customerId = o?.stripe_customer_id ?? null; }
      } catch { customerId = null; }
      if (customerId) {
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          const ev = await stripe.billing.meterEvents.create({ event_name: isSMS ? 'ashley_iq_sms' : 'ashley_iq_voice_min', payload: { stripe_customer_id: customerId, value: isSMS ? String(opts.quantity) : String(Math.ceil(opts.quantity / 60)) } });
          meterEventId = ev.identifier;
        } catch (e) { console.error('[recordUsage:stripe]', e); }
      }
    }
  }

  await sb.from('usage_events').insert({
    org_id: opts.orgId, user_id: opts.userId, loan_id: opts.loanId ?? null, event_type: opts.eventType, quantity: opts.quantity,
    source: 'manual', billed_to: billedTo, is_included_in_bundle: !isOverage, is_overage: isOverage, overage_amount_cents: isOverage ? overageCents : null,
    stripe_meter_event_id: meterEventId, twilio_sid: opts.twilioSid ?? null,
  });

  // Update the LO's manual usage cache (manual only).
  if (lob) {
    const patch: Record<string, number> = {};
    if (isSMS) patch.current_period_sms_count = (lob.current_period_sms_count ?? 0) + opts.quantity;
    if (isVoice) patch.current_period_voice_seconds = (lob.current_period_voice_seconds ?? 0) + opts.quantity;
    if (Object.keys(patch).length) await sb.from('lo_billing').update(patch).eq('user_id', opts.userId);
  }
}
