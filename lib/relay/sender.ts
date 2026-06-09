/**
 * Phase 31.2c — White-label sender identity (server-only).
 *
 * Every outbound communication (email, SMS, portal notification) identifies the
 * LOAN OFFICER and their COMPANY — never the platform. A borrower working with
 * two different LOs on Ashley IQ sees two completely different senders and never
 * learns they use the same software.
 *
 * NEVER include: "Ashley IQ", "PrimeMind", "Conduit", "powered by", any platform.
 */
import 'server-only';

/** Strings that must never appear in any outbound end-user communication. */
export const FORBIDDEN_PLATFORM_STRINGS = ['ashley iq', 'ashleyiq', 'primemind', 'prime mind', 'conduit', 'powered by'];

export interface LoIdentity {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}
export interface OrgIdentity {
  name?: string | null;
  reply_to_email?: string | null;
  twilio_number?: string | null;
}

export interface SenderIdentity {
  from_name: string;
  from_email: string;
  sms_from: string;
  signature: string;
}

export function buildSenderIdentity(lo: LoIdentity, org: OrgIdentity): SenderIdentity {
  const loName = `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() || 'Your Loan Officer';
  const company = (org.name ?? '').trim() || loName;
  return {
    from_name: `${loName} at ${company}`,
    from_email: org.reply_to_email || lo.email || '',
    sms_from: org.twilio_number || process.env.DEFAULT_TWILIO_NUMBER || '',
    signature: [loName, company, lo.phone ?? ''].filter(Boolean).join('\n'),
  };
}

/** Guard: throws if a built/templated message body leaks platform branding. */
export function assertNoPlatformBranding(text: string): void {
  const lower = text.toLowerCase();
  const hit = FORBIDDEN_PLATFORM_STRINGS.find((s) => lower.includes(s));
  if (hit) throw new Error(`Outbound communication must not reference the platform ("${hit}"). Use the LO + company identity.`);
}
