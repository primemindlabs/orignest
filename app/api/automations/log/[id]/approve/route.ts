// Phase 107 — LO approves a pending automation → send now.
//   - SMS: TCPA re-check on lead.sms_consent; Twilio-gated record-only unless
//     CAMPAIGNS_LIVE_SEND + creds (matches the rest of the app).
//   - Email: sendCompliantEmail (Resend, live).
//   - rendered_message is the trigger-time snapshot — never re-rendered here.
import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoId } from '@/lib/automations/loId';
import { sendCompliantEmail } from '@/lib/resend';

type Ctx = { params: Promise<{ id: string }> };

function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}
const liveSend = () => process.env.CAMPAIGNS_LIVE_SEND === 'true';

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const loId = await resolveLoId(sb, userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data: log } = await sb
    .from('milestone_automation_log')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('user_id', loId)
    .eq('approval_status', 'pending')
    .maybeSingle();
  if (!log) return NextResponse.json({ error: 'Not found or already processed' }, { status: 404 });

  let twilioSid: string | null = null;
  let resendId: string | null = null;
  let failedReason: string | null = null;

  try {
    const action = log.action_type as string;
    if (action.startsWith('sms')) {
      if (action === 'sms_borrower') {
        // TCPA re-check at send time (consent may have been withdrawn since queueing).
        const { data: lead } = await sb.from('leads').select('sms_consent').eq('id', log.lead_id).maybeSingle();
        if (!lead?.sms_consent) throw new Error('Borrower has not consented to SMS (sms_consent = false)');
      }
      if (!log.recipient_phone) throw new Error('No phone number on record');
      if (twilioConfigured() && liveSend()) {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        const msg = await client.messages.create({
          body: log.rendered_message,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: log.recipient_phone,
        });
        twilioSid = msg.sid;
      } else {
        twilioSid = 'record_only';
      }
    } else if (action.startsWith('email')) {
      if (!log.recipient_email) throw new Error('No email on record');
      const subject = action === 'email_realtor' ? 'Loan milestone update — your client' : 'Update on your mortgage';
      const res = await sendCompliantEmail({
        to: log.recipient_email,
        subject,
        text: log.rendered_message,
        orgId,
        recipientEmail: log.recipient_email,
        leadId: (log.lead_id as string | null) ?? null,
      });
      resendId = res?.id ?? null;
    }
  } catch (e: any) {
    failedReason = e?.message ?? 'Send failed';
  }

  await sb
    .from('milestone_automation_log')
    .update({
      approval_status: failedReason ? 'failed' : 'approved',
      approved_at: new Date().toISOString(),
      approved_by: loId,
      sent_at: failedReason ? null : new Date().toISOString(),
      twilio_message_sid: twilioSid,
      resend_message_id: resendId,
      failed_reason: failedReason,
    })
    .eq('id', id)
    .eq('org_id', orgId);

  if (failedReason) return NextResponse.json({ error: failedReason }, { status: 500 });
  return NextResponse.json({ ok: true, twilio_sid: twilioSid, resend_id: resendId });
}
