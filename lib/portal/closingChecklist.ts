/**
 * Phase 46.3 — closing-day prep checklist (shown at clear_to_close / closed).
 */
export const CLOSING_DAY_CHECKLIST: { category: string; items: { label: string; detail: string }[] }[] = [
  {
    category: '💰 Money',
    items: [
      { label: "Get a certified or cashier's check for closing costs", detail: 'Personal checks are typically not accepted. Your Closing Disclosure shows the exact amount needed.' },
      { label: 'If wiring funds: verify wire instructions by phone with the title company', detail: 'Wire fraud is common. Always call to confirm — never rely on emailed instructions alone.' },
      { label: 'Confirm the exact amount with your loan officer at least 48 hours before closing', detail: '' },
    ],
  },
  {
    category: '📄 Documents',
    items: [
      { label: 'Bring a valid government-issued photo ID', detail: 'All borrowers on the loan must bring ID.' },
      { label: 'Review your Closing Disclosure — compare it to your Loan Estimate', detail: 'You have a right to review the CD 3 business days before closing. Ask questions before closing day.' },
      { label: "Bring your homeowner's insurance binder (first year paid)", detail: 'Your insurance agent can provide this.' },
    ],
  },
  {
    category: '🏡 Property',
    items: [
      { label: 'Do a final walkthrough 24–48 hours before closing', detail: 'Confirm the property is in the agreed condition and any repairs are complete.' },
      { label: 'Confirm utilities transfer date with the sellers', detail: 'Make sure electricity, gas, and water transfer to your name on closing day.' },
    ],
  },
  {
    category: '👥 People',
    items: [
      { label: 'All borrowers on the loan must be present at closing', detail: 'If a co-borrower cannot attend, ask about a power of attorney — this requires advance notice.' },
      { label: 'Your agent and attorney (if applicable) may attend but are not required', detail: '' },
    ],
  },
];
