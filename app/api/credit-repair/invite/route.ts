/**
 * Phase 138 — invite a borrower to complete their credit-repair enrollment.
 * Closes the gap where an LO could enroll a borrower but had no way to send them
 * the completion link. Mints/reuses a borrower portal token, deep-links to the
 * credit-repair tab, and sends via SMS (TCPA-gated) and/or email. NMLS-gated like
 * all borrower comms. Mirrors /api/portal/send-link.
 */
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMyProfileId } from '@/lib/teamChat/access';
import { nmlsGate } from '@/lib/gates/clientFacingGate';
import { appUrl } from '@/lib/appUrl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as { enrollmentId?: string };
  if (!b.enrollmentId) return NextResponse.json({ error: 'enrollmentId required' }, { status: 400 });

  const sb = createAdminClient();
  const me = await getMyProfileId(sb, userId);
  if (!me) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // NMLS gate — borrower comms must carry the LO's NMLS # (RESPA/TRID).
  if (!(await nmlsGate(sb, me))) {
    return NextResponse.json({ error: 'Add your NMLS number in Settings → Profile before inviting borrowers.' }, { status: 403 });
  }

  const { data: enrollment } = await sb
    .from('credit_repair_enrollments')
    .select('id, lead_id, leads:lead_id (first_name, phone, email, sms_consent)')
    .eq('id', b.enrollmentId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!enrollment?.lead_id) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
  const lead = (Array.isArray(enrollment.leads) ? enrollment.leads[0] : enrollment.leads) as
    | { first_name: string | null; phone: string | null; email: string | null; sms_consent: boolean | null }
    | null;

  const canSms = Boolean(lead?.phone) && Boolean(lead?.sms_consent);
  const canEmail = Boolean(lead?.email);
  if (!canSms && !canEmail) {
    return NextResponse.json(
      { error: lead?.phone ? 'Borrower has not given SMS consent and has no email on file.' : 'No phone with SMS consent or email on file for this borrower.' },
      { status: 422 },
    );
  }

  // Mint or reuse the borrower portal token, deep-linked to the credit-repair tab.
  let token: string | null = null;
  const { data: existing } = await sb
    .from('borrower_portal_tokens')
    .select('token, expires_at')
    .eq('lead_id', enrollment.lead_id)
    .eq('org_id', orgId)
    .eq('participant_type', 'borrower')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing && (!existing.expires_at || new Date(existing.expires_at as string) > new Date())) {
    token = existing.token as string;
  } else {
    const fresh = randomBytes(32).toString('hex');
    const { data: created } = await sb
      .from('borrower_portal_tokens')
      .insert({ lead_id: enrollment.lead_id, org_id: orgId, token: fresh, participant_type: 'borrower', expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString() })
      .select('token')
      .single();
    token = (created?.token as string | undefined) ?? null;
  }
  if (!token) return NextResponse.json({ error: 'Could not create portal link' }, { status: 500 });

  const url = appUrl(`/status/${token}?tab=credit-repair`);
  const first = lead?.first_name ?? 'there';
  const sent: string[] = [];

  // SMS — gated Twilio send (record-only without creds), TCPA already enforced above.
  if (canSms) {
    const body = `Hi ${first}! Let's get your credit mortgage-ready. Start your secure credit-repair steps here: ${url}`;
    const live = process.env.PORTAL_LINK_LIVE === 'true' && Boolean(process.env.TWILIO_AUTH_TOKEN) && Boolean(process.env.TWILIO_ACCOUNT_SID);
    if (live) {
      try {
        const twilio = (await import('twilio')).default;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await client.messages.create({ to: lead!.phone as string, from: process.env.TWILIO_FROM_NUMBER ?? process.env.TWILIO_PHONE_NUMBER, body });
        sent.push('sms');
      } catch (e) {
        console.error('[credit-repair/invite twilio]', e);
      }
    } else {
      sent.push('sms-recorded');
    }
  }

  // Email — best-effort (CAN-SPAM footer enforced by sendCompliantEmail).
  if (canEmail) {
    try {
      const { sendCompliantEmail } = await import('@/lib/resend');
      await sendCompliantEmail({
        to: lead!.email as string,
        recipientEmail: lead!.email as string,
        orgId,
        leadId: enrollment.lead_id,
        subject: 'Your credit-repair steps are ready',
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #0F1D2E;">Let's get your credit mortgage-ready</h2>
            <p>Hi ${first}, your loan officer set up a guided credit-repair plan for you. It only takes a few minutes to get started.</p>
            <a href="${url}" style="display: inline-block; background: #C9A95C; color: #0F1D2E; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 700;">Start my credit steps</a>
          </div>`,
      });
      sent.push('email');
    } catch (e) {
      console.error('[credit-repair/invite email]', e);
    }
  }

  if (sent.length === 0) return NextResponse.json({ error: 'Could not send the invite. Check messaging configuration.' }, { status: 502 });
  return NextResponse.json({ ok: true, sent, portal_url: url });
}
