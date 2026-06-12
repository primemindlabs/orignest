/**
 * Phase 100 — realtor weekly market update email. The compliance disclosure
 * (rates-as-of / not-a-commitment / NMLS / Equal Housing Lender) appears IN FULL
 * in every email per the spec. The app-wide CAN-SPAM physical-address footer is
 * added separately by sendCompliantEmail.
 */
export interface MarketUpdateEmailParams {
  lo_name: string;
  lo_nmls: string;
  lo_company: string;
  lo_phone: string;
  lo_photo_url: string;
  realtor_first_name: string;
  week_of: string;
  rate_30yr_conv: number;
  rate_15yr_conv: number;
  rate_30yr_fha: number;
  rate_30yr_va: number;
  market_summary: string;
  talking_points: string[];
  unsubscribe_link: string;
}

function esc(s: string): string {
  return (s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

export function buildMarketUpdateEmail(p: MarketUpdateEmailParams): string {
  const rateRow = (label: string, rate: number) =>
    `<tr><td style="padding:8px 16px;font-size:14px;color:#374151;">${label}</td>` +
    `<td style="padding:8px 16px;font-size:14px;font-weight:600;color:#111827;text-align:right;">${rate.toFixed(3)}%</td></tr>`;

  const summaryHtml = esc(p.market_summary)
    .split('\n')
    .filter((x) => x.trim())
    .map((para) => `<p style="margin:12px 0 0;font-size:15px;color:#374151;line-height:1.6;">${para}</p>`)
    .join('');

  const points = p.talking_points
    .map((tp) => `<li style="margin-bottom:8px;font-size:14px;color:#374151;line-height:1.5;">${esc(tp)}</li>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9F9F9;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
    <tr><td style="padding:28px 32px;border-bottom:1px solid #F3F4F6;">
      <p style="margin:0;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.05em;">Week of ${esc(p.week_of)}</p>
      <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#111827;">Mortgage Market Update</h1>
    </td></tr>
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0;font-size:15px;color:#374151;">Hi ${esc(p.realtor_first_name)},</p>
      ${summaryHtml}
    </td></tr>
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Current Rates</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F9F9;border-radius:12px;overflow:hidden;">
        ${rateRow('30-Year Conventional', p.rate_30yr_conv)}
        ${rateRow('15-Year Conventional', p.rate_15yr_conv)}
        ${rateRow('30-Year FHA', p.rate_30yr_fha)}
        ${rateRow('30-Year VA', p.rate_30yr_va)}
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Talking Points for Your Buyers</p>
      <ul style="margin:0;padding:0 0 0 20px;">${points}</ul>
    </td></tr>
    <tr><td style="padding:24px 32px;">
      <table cellpadding="0" cellspacing="0" style="background:#F9F9F9;border-radius:12px;width:100%;"><tr>
        ${p.lo_photo_url ? `<td style="width:48px;padding:16px 0 16px 16px;vertical-align:middle;"><img src="${esc(p.lo_photo_url)}" width="48" height="48" style="border-radius:50%;object-fit:cover;" alt="${esc(p.lo_name)}" /></td>` : ''}
        <td style="padding:16px;vertical-align:middle;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#111827;">${esc(p.lo_name)}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6B7280;">${esc(p.lo_company)}${p.lo_nmls ? ` | NMLS# ${esc(p.lo_nmls)}` : ''}</p>
          ${p.lo_phone ? `<p style="margin:2px 0 0;font-size:12px;color:#C9A95C;">${esc(p.lo_phone)}</p>` : ''}
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 32px 24px;border-top:1px solid #F3F4F6;">
      <p style="margin:16px 0 0;font-size:10px;color:#9CA3AF;line-height:1.5;">
        Rates as of ${esc(p.week_of)}. Subject to change without notice. Not a commitment to lend.
        Your rate will vary based on credit profile, loan-to-value, property type, and other factors.
        ${esc(p.lo_name)} | NMLS# ${esc(p.lo_nmls)} | ${esc(p.lo_company)} | Equal Housing Lender.
        <a href="${esc(p.unsubscribe_link)}" style="color:#9CA3AF;">Unsubscribe</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
