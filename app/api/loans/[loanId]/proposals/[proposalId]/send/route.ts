// Phase 122 — deliver a proposal link to the borrower by email or SMS (TCPA-gated).
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import twilio from 'twilio';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendSMS } from '@/lib/communications/canSendSMS';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

export async function POST(request: Request, { params }: { params: { loanId: string; proposalId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const channel = (b.channel ?? 'email').toString();
  if (!['email', 'sms'].includes(channel)) return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });

  const sb = createAdminClient();
  const { data: proposal } = await sb
    .from('loan_proposals')
    .select('id, share_token, lead_id')
    .eq('id', params.proposalId)
    .eq('org_id', orgId)
    .eq('lead_id', params.loanId)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });

  const { data: lead } = await sb.from('leads').select('first_name, email, phone').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const { data: lo } = await sb.from('profiles').select('first_name, last_name, nmls_id').eq('clerk_user_id', userId).maybeSingle();
  const loName = lo ? [lo.first_name, lo.last_name].filter(Boolean).join(' ') || 'Your loan officer' : 'Your loan officer';

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `https://${h.get('host') ?? 'app.ashleyiq.com'}`;
  const url = `${origin}/proposal/${proposal.share_token}`;

  let delivered = false;

  if (channel === 'email') {
    if (!lead.email) return NextResponse.json({ error: 'Borrower has no email on file' }, { status: 400 });
    if (process.env.RESEND_API_KEY) {
      try {
        const { sendCompliantEmail } = await import('@/lib/resend');
        const nmls = lo?.nmls_id ? `NMLS# ${lo.nmls_id}` : 'NMLS ID on file';
        await sendCompliantEmail({
          to: lead.email as string,
          recipientEmail: lead.email as string,
          subject: 'Your personalized loan proposal',
          html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#0F1D2E;">
            <p>Hi ${lead.first_name ?? 'there'},</p>
            <p style="line-height:1.6;">I've prepared a personalized loan proposal for you with a clear comparison of your options. You can review it here:</p>
            <a href="${url}" style="display:inline-block;background:#C9A95C;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;">View your proposal</a>
            <p style="margin-top:24px;">Warm regards,<br/><strong>${loName}</strong></p>
            <p style="margin-top:24px;color:#9A9AA0;font-size:12px;">${loName}, ${nmls}. This proposal is for informational purposes and is not a commitment to lend. Equal Housing Lender.</p>
          </div>`,
          orgId,
          leadId: params.loanId,
        });
        delivered = true;
      } catch {
        delivered = false;
      }
    }
  } else {
    // SMS — TCPA gate first.
    const gate = await canSendSMS(sb, { orgId, leadId: params.loanId, category: 'loan_updates' });
    if (!gate.allowed) return NextResponse.json({ error: gate.reason ?? 'SMS not permitted for this contact' }, { status: 403 });
    if (!lead.phone) return NextResponse.json({ error: 'Borrower has no phone on file' }, { status: 400 });
    if (twilioConfigured()) {
      try {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await client.messages.create({ body: `${lead.first_name ?? 'Hi'}, your personalized loan proposal from ${loName} is ready: ${url}`, from: process.env.TWILIO_PHONE_NUMBER!, to: lead.phone as string });
        delivered = true;
      } catch {
        delivered = false;
      }
    }
  }

  await sb.from('loan_proposals').update({ sent_at: new Date().toISOString(), sent_channel: channel }).eq('id', params.proposalId).eq('org_id', orgId);

  return NextResponse.json({ ok: true, delivered, url });
}
