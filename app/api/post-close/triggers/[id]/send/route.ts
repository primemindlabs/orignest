// Phase 103 — send a reviewed post-close outreach draft.
//   - org-scoped; status must be 'queued'
//   - SMS: phone required; sms_opt_outs guard; Twilio-gated record-only unless
//     CAMPAIGNS_LIVE_SEND + creds are set (matches the rest of the app)
//   - on success: mark sent + reviewed_by, write the relationship_rate_alerts audit row
import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCompliantEmail } from '@/lib/resend';

type Ctx = { params: Promise<{ id: string }> };

function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}
const liveSend = () => process.env.CAMPAIGNS_LIVE_SEND === 'true';

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: trigger } = await sb
    .from('post_close_outreach')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!trigger) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (trigger.status !== 'queued') return NextResponse.json({ error: 'Already actioned' }, { status: 400 });

  // Resolve the caller's profile id (reviewer).
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const reviewerId = (profile?.id as string | undefined) ?? null;

  const { data: rel } = await sb
    .from('borrower_relationships')
    .select('phone, email, original_rate, current_market_rate, monthly_savings_if_refi')
    .eq('id', trigger.relationship_id)
    .maybeSingle();

  try {
    if (trigger.channel === 'sms') {
      const phone = (rel?.phone as string | null) ?? null;
      if (!phone) return NextResponse.json({ error: 'No phone on file' }, { status: 400 });

      const { data: optOut } = await sb
        .from('sms_opt_outs')
        .select('id')
        .eq('org_id', orgId)
        .eq('phone', phone)
        .maybeSingle();
      if (optOut) return NextResponse.json({ error: 'Recipient has opted out of SMS' }, { status: 400 });

      if (twilioConfigured() && liveSend()) {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await client.messages.create({
          body: trigger.outreach_message,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: phone,
        });
      }
    } else {
      const email = (rel?.email as string | null) ?? null;
      if (!email) return NextResponse.json({ error: 'No email on file' }, { status: 400 });
      await sendCompliantEmail({
        to: email,
        subject: 'A quick check-in on your home',
        text: trigger.outreach_message,
        orgId,
        recipientEmail: email,
      });
    }

    const nowIso = new Date().toISOString();
    await sb
      .from('post_close_outreach')
      .update({ status: 'sent', sent_at: nowIso, reviewed_by: reviewerId })
      .eq('id', id)
      .eq('org_id', orgId);

    // Append the immutable sent-audit row (existing Phase 28 table). Its check allows
    // rate_drop / equity_milestone / anniversary / market_update.
    const auditType =
      trigger.trigger_type === 'equity_gain'
        ? 'equity_milestone'
        : trigger.trigger_type === 'manual'
          ? 'market_update'
          : trigger.trigger_type;
    await sb.from('relationship_rate_alerts').insert({
      relationship_id: trigger.relationship_id,
      org_id: orgId,
      trigger_type: auditType,
      original_rate: rel?.original_rate ?? null,
      current_rate: rel?.current_market_rate ?? null,
      monthly_savings: rel?.monthly_savings_if_refi ?? null,
      sent_via: trigger.channel,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Send failed' }, { status: 500 });
  }
}
