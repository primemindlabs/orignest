import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set.');
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@ashleyiq.com';
export const FROM_NAME = 'AshleyIQ';
export const FROM = `${FROM_NAME} <${FROM_EMAIL}>`;

/**
 * Canonical outbound-email path. Injects the CAN-SPAM compliance footer
 * (sender identity + physical address + unsubscribe) and THROWS before sending
 * if COMPANY_PHYSICAL_ADDRESS is not configured — a non-compliant email is never
 * delivered. All outbound sends should go through this.
 */
export async function sendCompliantEmail(params: {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  orgId?: string | null;
  recipientEmail?: string;
  leadId?: string | null;
}): Promise<{ id?: string } | undefined> {
  const { complianceFooterHtml, complianceFooterText, requirePhysicalAddress } = await import('@/lib/email/footer');
  const recipient = params.recipientEmail ?? (Array.isArray(params.to) ? params.to[0] : params.to);
  const footerArgs = { orgId: params.orgId ?? null, email: recipient, leadId: params.leadId ?? null };

  // Building the footer THROWS if the physical-address env is missing — a
  // non-compliant email is never assembled or sent.
  const payload: Record<string, unknown> = { from: params.from ?? FROM, to: params.to, subject: params.subject };
  if (params.html != null) payload.html = `${params.html}${complianceFooterHtml(footerArgs)}`;
  if (params.text != null) payload.text = `${params.text}${complianceFooterText(footerArgs)}`;
  if (params.html == null && params.text == null) requirePhysicalAddress(); // gate even when body is templated elsewhere
  if (params.replyTo) payload.replyTo = params.replyTo;
  if (params.headers) payload.headers = params.headers;

  const resend = getResend();
  const { data } = await resend.emails.send(payload as unknown as Parameters<typeof resend.emails.send>[0]);
  return data ?? undefined;
}

/**
 * Send a payment failed notification to the org admin.
 */
export async function sendPaymentFailedEmail(params: {
  to: string;
  orgName: string;
  amount: number;
  invoiceUrl: string;
}): Promise<void> {
  await sendCompliantEmail({
    to: params.to,
    recipientEmail: params.to,
    subject: 'Action required: Payment failed for AshleyIQ',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #0F1D2E;">Payment Failed</h2>
        <p>We were unable to process a payment of <strong>$${(params.amount / 100).toFixed(2)}</strong> for your AshleyIQ account (<strong>${params.orgName}</strong>).</p>
        <p>To avoid service interruption, please update your payment method:</p>
        <a href="${params.invoiceUrl}" style="display: inline-block; background: #007AFF; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">Update Payment Method</a>
        <p style="margin-top: 24px; color: #6C6C70; font-size: 14px;">If you have questions, contact <a href="mailto:support@ashleyiq.com">support@ashleyiq.com</a>.</p>
      </div>
    `,
  });
}

/**
 * Send a subscription canceled notification.
 */
export async function sendSubscriptionCanceledEmail(params: {
  to: string;
  orgName: string;
  endDate: string;
}): Promise<void> {
  await sendCompliantEmail({
    to: params.to,
    recipientEmail: params.to,
    subject: 'Your AshleyIQ subscription has been canceled',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #0F1D2E;">Subscription Canceled</h2>
        <p>Your AshleyIQ subscription for <strong>${params.orgName}</strong> has been canceled.</p>
        <p>You will retain access until <strong>${params.endDate}</strong>. After that date, your account will be deactivated and data will be retained per our retention policy.</p>
        <p>Changed your mind? <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/billing">Reactivate your subscription</a>.</p>
        <p style="color: #6C6C70; font-size: 14px;">Questions? <a href="mailto:support@ashleyiq.com">support@ashleyiq.com</a></p>
      </div>
    `,
  });
}

/**
 * Send TRID alert email to assigned loan officer.
 */
export async function sendTRIDAlertEmail(params: {
  to: string;
  officerName: string;
  borrowerName: string;
  leadId: string;
  alertType: 'le_due' | 'le_overdue' | 'cd_due' | 'cd_overdue';
  deadline: string;
}): Promise<void> {
  const labels: Record<string, string> = {
    le_due: 'Loan Estimate Due Today',
    le_overdue: 'Loan Estimate OVERDUE',
    cd_due: 'Closing Disclosure Due Today',
    cd_overdue: 'Closing Disclosure OVERDUE',
  };

  const isOverdue = params.alertType.includes('overdue');
  const color = isOverdue ? '#FF3B30' : '#FF9500';

  await sendCompliantEmail({
    to: params.to,
    recipientEmail: params.to,
    subject: `TRID Alert: ${labels[params.alertType]} — ${params.borrowerName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: ${color}; color: white; padding: 16px 20px; border-radius: 10px; margin-bottom: 24px;">
          <strong>TRID Compliance Alert: ${labels[params.alertType]}</strong>
        </div>
        <p>Hi ${params.officerName},</p>
        <p>A TRID disclosure is ${isOverdue ? 'overdue' : 'due today'} for borrower <strong>${params.borrowerName}</strong>.</p>
        <p><strong>Deadline:</strong> ${params.deadline}</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/leads/${params.leadId}?tab=trid" style="display: inline-block; background: #007AFF; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600;">View TRID Status</a>
        <p style="margin-top: 24px; color: #FF3B30; font-size: 14px;">Failure to deliver required TRID disclosures on time may result in regulatory penalties. Please take immediate action.</p>
      </div>
    `,
  });
}
