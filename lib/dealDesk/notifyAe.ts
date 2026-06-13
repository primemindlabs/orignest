/**
 * Phase 120 — notify a lender Account Executive of a pricing request. SERVER-ONLY.
 * B2B transactional (LO → their lender rep), so this does NOT use the consumer
 * CAN-SPAM wrapper (no borrower unsubscribe footer). GATED: if RESEND_API_KEY is
 * unset it no-ops and returns { sent:false } so the desk still works record-only.
 * An NMLS disclaimer is always appended to outbound AE communications.
 */
import 'server-only';

interface NotifyArgs {
  to: string;
  aeName: string | null;
  loName: string | null;
  loNmls: string | null;
  respondUrl: string;
  request: {
    lender_name: string | null;
    loan_type: string | null;
    loan_amount: number | null;
    ltv: number | null;
    fico_score: number | null;
    loan_purpose: string | null;
    occupancy: string | null;
    requested_rate: number | null;
    requested_price: number | null;
    lock_period_days: number | null;
    exception_reason: string | null;
  };
}

const money = (n: number | null) => (n == null ? '—' : `$${Math.round(n).toLocaleString()}`);
const pct = (n: number | null) => (n == null ? '—' : `${n}%`);

export async function notifyAe(args: NotifyArgs): Promise<{ sent: boolean }> {
  if (!process.env.RESEND_API_KEY) return { sent: false };

  const r = args.request;
  const rows: [string, string][] = [
    ['Lender', r.lender_name ?? '—'],
    ['Loan type', r.loan_type ?? '—'],
    ['Loan amount', money(r.loan_amount)],
    ['LTV', pct(r.ltv)],
    ['FICO', r.fico_score != null ? String(r.fico_score) : '—'],
    ['Purpose', r.loan_purpose ?? '—'],
    ['Occupancy', r.occupancy ?? '—'],
    ['Requested rate', pct(r.requested_rate)],
    ['Requested price', r.requested_price != null ? String(r.requested_price) : '—'],
    ['Lock period', r.lock_period_days != null ? `${r.lock_period_days} days` : '—'],
  ];
  const tableRows = rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6C6C70;">${k}</td><td style="padding:4px 0;color:#0F1D2E;font-weight:600;">${v}</td></tr>`)
    .join('');

  const nmls = args.loNmls ? `NMLS# ${args.loNmls}` : 'NMLS ID on file';
  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;">
      <h2 style="color:#0F1D2E;margin:0 0 4px;">Pricing request</h2>
      <p style="color:#6C6C70;margin:0 0 20px;">${args.loName ?? 'A loan officer'} has sent you a scenario for pricing.</p>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px;">${tableRows}</table>
      ${r.exception_reason ? `<p style="font-size:14px;color:#0F1D2E;"><strong>Exception requested:</strong> ${r.exception_reason}</p>` : ''}
      <a href="${args.respondUrl}" style="display:inline-block;background:#C9A95C;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:600;margin-top:8px;">Respond with pricing</a>
      <p style="margin-top:28px;color:#9A9AA0;font-size:12px;line-height:1.5;">
        This request is for scenario pricing only and is not a rate lock, commitment, or offer to lend.
        Rates and pricing are subject to change and confirmation. Sent by ${args.loName ?? 'a loan officer'}, ${nmls}.
      </p>
    </div>`;

  const { getResend, FROM } = await import('@/lib/resend');
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: args.to,
    subject: `Pricing request${args.request.lender_name ? ` — ${args.request.lender_name}` : ''}`,
    html,
    replyTo: undefined,
  } as unknown as Parameters<ReturnType<typeof getResend>['emails']['send']>[0]);

  return { sent: true };
}
