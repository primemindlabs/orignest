/**
 * Phase 94 — Arrive relocation welcome email (first borrower touch).
 *
 * EMAIL ONLY by design: Arrive collects its own TCPA consent in their flow, but
 * that does NOT transfer to our records. We send no SMS until the borrower
 * acknowledges TCPA in the portal. Copy stays compliant — no rate/APR claims.
 */
import type { ArriveLead } from './importLead';

const GOLD = '#C9A95C';
const INK = '#0F1D2E';
const PAPER = '#FAFAF8';

export function buildArriveWelcomeEmail(
  payload: ArriveLead,
  lo: { name: string; email: string | null },
  portalUrl: string,
): string {
  const first = (payload.firstName ?? '').trim() || 'there';
  const dest = (payload.destinationCity ?? '').trim();
  const origin = (payload.originCity ?? '').trim();
  const moveLine =
    origin && dest
      ? `your move from ${escapeHtml(origin)} to ${escapeHtml(dest)}`
      : dest
        ? `your move to ${escapeHtml(dest)}`
        : 'your upcoming move';

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: ${PAPER}; max-width: 600px; margin: 0 auto; padding: 40px 24px; color: ${INK};">
    <div style="border-left: 3px solid ${GOLD}; padding-left: 16px; margin-bottom: 28px;">
      <p style="font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; color: ${GOLD}; margin: 0 0 6px; font-weight: 600;">Welcome via Arrive</p>
      <h1 style="font-size: 22px; margin: 0; line-height: 1.3;">Hi ${escapeHtml(first)}, I'll be your mortgage advisor</h1>
    </div>

    <p style="font-size: 15px; line-height: 1.6;">
      Congratulations on ${moveLine}! Arrive connected us so you have a dedicated mortgage advisor
      from day one. I'm here to help you get pre-approved, understand your budget, and move with confidence.
    </p>

    <p style="font-size: 15px; line-height: 1.6;">
      The best next step is to start your application — it takes just a few minutes and lets me tailor
      everything to your situation:
    </p>

    <p style="text-align: center; margin: 28px 0;">
      <a href="${portalUrl}" style="display: inline-block; background: ${INK}; color: #fff; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px;">Start my application</a>
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #4a5568;">
      Have questions first? Just reply to this email${lo.email ? ` or reach me at <a href="mailto:${escapeHtml(lo.email)}" style="color: ${INK};">${escapeHtml(lo.email)}</a>` : ''} and I'll get right back to you.
    </p>

    <p style="font-size: 14px; line-height: 1.6; margin-top: 24px;">
      Looking forward to working with you,<br/>
      <strong>${escapeHtml(lo.name)}</strong>
    </p>

    <hr style="border: none; border-top: 1px solid #E5E3DF; margin: 28px 0;" />
    <p style="font-size: 12px; color: #8a8a8a; line-height: 1.5;">
      You're receiving this because you requested mortgage help through Arrive. To enable text-message
      updates from your advisor, you can opt in inside your secure portal — we won't text you until you do.
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
