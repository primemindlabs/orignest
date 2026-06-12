// Phase 102 — outreach message templates. PURE / testable.
//
// Rules:
//   - First name ONLY in borrower messages (never last_name).
//   - NMLS # REQUIRED on all three borrower templates (regulatory). Realtor
//     partnership messages do NOT include NMLS.
//   - Warm, not clinical: birthday templates show no age and no year.
//   - LO-branded, never platform-branded (caller may run assertNoPlatformBranding).

export const TEMPLATES = {
  birthday: (firstName: string, loName: string, nmls: string): string =>
    `Happy birthday, ${firstName}! Wishing you a wonderful day. — ${loName}, NMLS #${nmls}`,

  home_anniversary: (firstName: string, years: number, loName: string, nmls: string): string =>
    `Happy ${years}-year home anniversary, ${firstName}! ` +
    `Hope you're loving every moment in your home. — ${loName}, NMLS #${nmls}`,

  loan_anniversary: (firstName: string, years: number, loName: string, nmls: string): string =>
    `It's been ${years} year${years > 1 ? 's' : ''} since we closed your loan, ${firstName}! ` +
    `Congrats on the milestone. If you ever have mortgage questions, I'm here. ` +
    `— ${loName}, NMLS #${nmls}`,

  realtor_anniversary: (realtorName: string, years: number, loName: string): string =>
    `Hi ${realtorName} — hard to believe it's been ${years} year${years > 1 ? 's' : ''} ` +
    `of working together! Thank you for your trust and all the referrals. ` +
    `Looking forward to many more deals. — ${loName}`,
};

export type OutreachEventType =
  | 'birthday'
  | 'home_anniversary'
  | 'loan_anniversary'
  | 'realtor_anniversary';

export interface DraftInput {
  event_type: OutreachEventType;
  event_date: string; // ISO date — original event date (used for anniversary year calc)
  first_name: string; // borrower first name, or realtor display name for realtor events
  lo_name: string;
  lo_nmls: string; // ignored for realtor events
}

/** Floor of whole years elapsed since `date` (365.25-day years). */
export function computeYearsSince(date: Date): number {
  const today = new Date();
  return Math.floor((today.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

/** Render the correct template for a life event. Throws on unknown type. */
export function buildMessageDraft(event: DraftInput): string {
  const years = computeYearsSince(new Date(event.event_date));
  switch (event.event_type) {
    case 'birthday':
      return TEMPLATES.birthday(event.first_name, event.lo_name, event.lo_nmls);
    case 'home_anniversary':
      return TEMPLATES.home_anniversary(event.first_name, years, event.lo_name, event.lo_nmls);
    case 'loan_anniversary':
      return TEMPLATES.loan_anniversary(event.first_name, years, event.lo_name, event.lo_nmls);
    case 'realtor_anniversary':
      return TEMPLATES.realtor_anniversary(event.first_name, years, event.lo_name);
    default:
      throw new Error(`Unknown event_type: ${event.event_type}`);
  }
}

export const EVENT_TYPE_LABEL: Record<OutreachEventType, string> = {
  birthday: 'Birthday',
  home_anniversary: 'Home Anniversary',
  loan_anniversary: 'Loan Anniversary',
  realtor_anniversary: 'Partnership Anniversary',
};
