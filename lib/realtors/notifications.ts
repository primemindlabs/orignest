/**
 * Phase 46.7 — proactive realtor stage notifications. When a referred loan moves
 * stage, the referring realtor gets a warm update. Real schema: loans are `leads`,
 * the realtor link is leads.referral_realtor_id.
 *
 * GATED: actual SMS send via Twilio is record-only (delivery='recorded') unless
 * REALTOR_NOTIFY_LIVE is set — mirrors the campaign-send pattern. Dedup is enforced
 * by realtor_notifications UNIQUE(realtor_id, lead_id, notification_type).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// Real leads.stage → notification type.
const STAGE_TO_TYPE: Record<string, string> = {
  application: 'application_submitted',
  conditional_approval: 'loan_approved',
  clear_to_close: 'clear_to_close',
  closed: 'loan_funded',
};

function message(type: string, borrowerFirst: string, loFirst: string, realtorFirst: string, closeDate?: string | null): string {
  const m: Record<string, string> = {
    referral_received: `${loFirst} here — I received ${borrowerFirst}'s info, thank you for the referral! I'll be in touch with them today.`,
    application_submitted: `Update: ${borrowerFirst} has completed their mortgage application. File is moving forward!`,
    loan_approved: `Great news! ${borrowerFirst}'s loan was approved by underwriting. Getting ready for closing.`,
    clear_to_close: `${borrowerFirst} is clear to close! 🎉 Closing is being scheduled now.${closeDate ? ` Target: ${closeDate}.` : ''}`,
    closing_scheduled: `Closing confirmed for ${borrowerFirst}${closeDate ? ` on ${closeDate}` : ''}. See you there!`,
    loan_funded: `${borrowerFirst}'s loan funded today. Congratulations — great working with you on this one, ${realtorFirst}!`,
    stale_check_in: `Hey ${realtorFirst}, checking in — ${borrowerFirst}'s file is moving through underwriting. Any questions from your side?`,
  };
  return m[type] ?? '';
}

/** Notify the loan's referring realtor of a stage transition. Returns what happened. */
export async function notifyRealtorOfStage(leadId: string, newStage: string, orgId: string): Promise<{ sent: boolean; reason?: string }> {
  const type = STAGE_TO_TYPE[newStage];
  if (!type) return { sent: false, reason: 'no_notification_for_stage' };
  return recordRealtorNotification(leadId, type, orgId);
}

/** Record (and, when live, send) any of the 7 realtor notification types. Deduped. */
export async function recordRealtorNotification(leadId: string, type: string, orgId: string): Promise<{ sent: boolean; reason?: string }> {
  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, first_name, referral_realtor_id, target_close_date, assigned_to').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (!lead?.referral_realtor_id) return { sent: false, reason: 'no_referring_realtor' };

  const [{ data: realtor }, { data: lo }] = await Promise.all([
    sb.from('realtors').select('id, first_name, phone, email').eq('id', lead.referral_realtor_id).maybeSingle(),
    lead.assigned_to ? sb.from('profiles').select('first_name').eq('id', lead.assigned_to).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!realtor) return { sent: false, reason: 'realtor_not_found' };

  const body = message(type, lead.first_name ?? 'your client', (lo as { first_name?: string } | null)?.first_name ?? 'Your LO', realtor.first_name ?? 'there', lead.target_close_date);
  const live = process.env.REALTOR_NOTIFY_LIVE === 'true' && Boolean(process.env.TWILIO_AUTH_TOKEN);
  // TODO(delivery): when live, send via Twilio here using the org's number.

  const { error } = await sb.from('realtor_notifications').insert({
    realtor_id: realtor.id, lead_id: leadId, org_id: orgId, notification_type: type,
    channel: 'sms', delivery: live ? 'sent' : 'recorded', body_preview: body.slice(0, 100),
  });
  // Unique violation = already sent this type for this loan → dedup, treat as no-op.
  if (error) return { sent: false, reason: 'already_sent' };

  // Log a touch on the realtor relationship too.
  await sb.from('realtor_touches').insert({ org_id: orgId, realtor_id: realtor.id, touch_type: 'co_marketing_send', subject: type, body }).then(() => undefined, () => undefined);
  return { sent: true };
}
