// Phase 103 — post-close outreach copy. PURE. LO-branded, opt-out line included.
//
// Compliance: rate-drop copy carries "Not a commitment to lend" and ALWAYS requires
// human review before sending. No specific rate number is embedded in the borrower
// message (the rate delta lives in trigger_details for the LO's eyes only).

export function buildRateDropMessage(params: {
  first_name: string;
  lo_name: string;
  lo_phone: string;
}): string {
  return (
    `Hi ${params.first_name}, rates have moved since you closed. I wanted to check in — ` +
    `it may be worth a quick conversation to see if anything makes sense for your situation. ` +
    `Not a commitment to lend. ${params.lo_name} ${params.lo_phone} Reply STOP to opt out.`
  );
}

export function buildEquityMessage(params: {
  first_name: string;
  lo_name: string;
  lo_phone: string;
}): string {
  return (
    `Hi ${params.first_name}! Your home equity may have grown significantly. Many homeowners ` +
    `are using equity for home improvements or other goals. Want a free snapshot of where you ` +
    `stand? ${params.lo_name} ${params.lo_phone} Reply STOP to opt out.`
  );
}

// Retained for completeness / manual use. Phase 103 detection does NOT emit
// anniversary outreach — that is owned by Phase 102 (life_events / outreach_queue).
export function buildAnniversaryMessage(params: {
  first_name: string;
  years: number;
  lo_name: string;
  lo_phone: string;
}): string {
  return (
    `Happy ${params.years}-year home anniversary, ${params.first_name}! 🏡 Time flies! ` +
    `Always here if you have questions about your equity or anything mortgage-related. ` +
    `${params.lo_name} ${params.lo_phone} Reply STOP to opt out.`
  );
}

export const firstNameOf = (fullName: string): string =>
  (fullName ?? '').trim().split(/\s+/)[0] || 'there';
