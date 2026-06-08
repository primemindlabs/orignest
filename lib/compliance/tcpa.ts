/**
 * TCPA (Telephone Consumer Protection Act) compliance utilities.
 *
 * Core rules enforced:
 * 1. SMS cannot be sent without explicit written consent (sms_consent = true + timestamp)
 * 2. Email cannot be sent if the lead has unsubscribed (CAN-SPAM compliance)
 * 3. All consent events are logged with IP address, timestamp, and exact consent text
 * 4. Consent can be withdrawn at any time — system must honor within 10 business days
 */

interface SMSConsentData {
  sms_consent: boolean;
  sms_consent_obtained_at: string | null;
  sms_consent_ip: string | null;
  sms_consent_text: string | null;
}

interface EmailConsentData {
  unsubscribed_email: boolean;
  unsubscribed_at: string | null;
}

/**
 * Assert that SMS consent has been properly obtained before sending any automated SMS.
 * Throws a typed error that API routes can catch and return as 400.
 */
export function assertSMSConsent(lead: SMSConsentData): void {
  if (!lead.sms_consent) {
    throw new TCPAViolationError(
      'SMS_CONSENT_NOT_OBTAINED',
      'SMS consent has not been obtained for this lead. Obtain explicit written consent before sending any automated SMS messages.',
      { lead_sms_consent: lead.sms_consent }
    );
  }

  if (!lead.sms_consent_obtained_at) {
    throw new TCPAViolationError(
      'SMS_CONSENT_TIMESTAMP_MISSING',
      'SMS consent record is missing the timestamp. This consent cannot be used until properly timestamped.',
      { lead_sms_consent: lead.sms_consent }
    );
  }

  if (!lead.sms_consent_text) {
    throw new TCPAViolationError(
      'SMS_CONSENT_TEXT_MISSING',
      'SMS consent record is missing the consent disclosure text. The exact language shown to the consumer must be recorded.',
      {}
    );
  }
}

/**
 * Assert that email consent has not been revoked before sending any outbound email.
 */
export function assertEmailConsent(lead: EmailConsentData): void {
  if (lead.unsubscribed_email) {
    const unsubDate = lead.unsubscribed_at
      ? new Date(lead.unsubscribed_at).toLocaleDateString('en-US')
      : 'unknown date';

    throw new TCPAViolationError(
      'EMAIL_UNSUBSCRIBED',
      `This lead unsubscribed from email communications on ${unsubDate}. Cannot send any further email to this address per CAN-SPAM Act requirements.`,
      { unsubscribed_at: lead.unsubscribed_at }
    );
  }
}

/**
 * Validate a new SMS consent record before persisting it.
 * Call this when the borrower submits a form with TCPA consent checked.
 */
export function validateConsentRecord(params: {
  consentGiven: boolean;
  consentText: string;
  ipAddress: string;
  userAgent?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!params.consentGiven) {
    errors.push('Consent box was not checked.');
  }

  if (!params.consentText || params.consentText.trim().length < 20) {
    errors.push('Consent disclosure text is too short or missing.');
  }

  if (!params.ipAddress || !/^[\d.:\[\]a-fA-F]+$/.test(params.ipAddress)) {
    errors.push('Valid IP address is required for consent audit trail.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Standard TCPA consent disclosure text shown to borrowers.
 * This exact text must be displayed and stored in sms_consent_text.
 */
export const STANDARD_TCPA_CONSENT_TEXT =
  'By checking this box, I consent to receive automated text messages from AshleyIQ ' +
  'and the loan officer I am working with at the phone number provided. Message and data ' +
  'rates may apply. Message frequency varies. Reply STOP to opt out at any time. ' +
  'Reply HELP for help. See our Privacy Policy for details.';

/**
 * Quiet hours enforcement (TCPA best practice): no automated calls/SMS
 * before 8 AM or after 9 PM in the recipient's local time zone.
 */
export function isWithinTCPAQuietHours(
  recipientTimezone: string,
  now: Date = new Date()
): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: recipientTimezone,
      hour: 'numeric',
      hour12: false,
    });
    const hourStr = formatter.format(now);
    const hour = parseInt(hourStr, 10);
    // Quiet hours: before 8 AM or at/after 9 PM (21:00)
    return hour < 8 || hour >= 21;
  } catch {
    // If timezone is invalid, default to blocking (safe fail)
    return true;
  }
}

/**
 * Typed TCPA violation error — allows API routes to return 400 with compliance context.
 */
export class TCPAViolationError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(code: string, message: string, context: Record<string, unknown>) {
    super(message);
    this.name = 'TCPAViolationError';
    this.code = code;
    this.context = context;
  }
}
