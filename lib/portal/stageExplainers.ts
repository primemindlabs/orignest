/**
 * Phase 46.2 — per-stage plain-language explainers for the borrower. Keyed to the
 * REAL leads.stage values. {lo} is replaced with the LO's first name.
 */
export interface StageExplainer {
  headline: string; what_it_means: string; typical_time: string; you_need_to: string;
  faq: { q: string; a: string }[];
}

const RAW: Record<string, StageExplainer> = {
  new_inquiry: {
    headline: "We're getting started!", what_it_means: '{lo} is reviewing your initial information and setting up your file.',
    typical_time: '1–2 business days', you_need_to: "Watch for a portal invite — you'll be asked to upload some initial documents soon.",
    faq: [{ q: 'Do I need to do anything right now?', a: "Not yet! We'll send you a link when we need your documents." }],
  },
  pre_qual: {
    headline: 'Great first step!', what_it_means: '{lo} is reviewing your financials to estimate what you may qualify for. This is not a commitment to lend.',
    typical_time: '1–3 business days', you_need_to: 'Upload any documents requested in your checklist below.',
    faq: [
      { q: 'Does this affect my credit?', a: 'A pre-qualification typically uses a soft credit pull, which does not affect your score.' },
      { q: 'Is a pre-qual the same as pre-approval?', a: "No. A pre-approval is more thorough and requires income/asset verification. We'll move there next!" },
    ],
  },
  application: {
    headline: 'Application submitted', what_it_means: '{lo} has your application and is preparing your file for processing.',
    typical_time: '2–3 business days', you_need_to: 'Make sure every checklist item is uploaded so nothing slows the file down.',
    faq: [{ q: 'What happens next?', a: 'Your file moves to processing, where we verify your documents and order the appraisal.' }],
  },
  processing: {
    headline: 'Your file is being built', what_it_means: 'Our processor is verifying your income, assets, and ordering the property appraisal. This is one of the busier stages.',
    typical_time: '2–3 weeks', you_need_to: 'Respond quickly to any document requests — delays here can affect your closing date.',
    faq: [
      { q: 'Why do you need so many documents?', a: 'Federal regulations require lenders to verify income, employment, and assets. The more we verify upfront, the smoother underwriting goes.' },
      { q: 'Should I make any big purchases right now?', a: 'Please hold off on large purchases (cars, furniture) or opening new credit until after closing — they can affect your qualification.' },
    ],
  },
  underwriting: {
    headline: "In the underwriter's hands", what_it_means: "Your complete file has been submitted to the underwriter, who's reviewing everything to make a final decision.",
    typical_time: '3–7 business days', you_need_to: 'Nothing right now — but be ready to respond quickly if the underwriter needs more information.',
    faq: [{ q: 'What is an underwriter?', a: 'The person at the lender who reviews your file and makes the final lending decision. They are independent from your loan officer.' }],
  },
  conditional_approval: {
    headline: 'Almost there — a few more items needed', what_it_means: 'The underwriter approved your file with conditions. We need to satisfy these before you can close.',
    typical_time: '1–2 weeks to clear conditions', you_need_to: 'Check your checklist — some new items may have been added. Respond as quickly as possible.',
    faq: [
      { q: 'Is a conditional approval bad?', a: 'No — this is normal and happens on the majority of loans. The underwriter just needs a few more pieces of information.' },
      { q: 'What happens after conditions clear?', a: "You'll receive a Clear to Close — the green light to schedule your closing!" },
    ],
  },
  clear_to_close: {
    headline: "🎉 You're clear to close!", what_it_means: 'The underwriter approved your loan. You are officially cleared to close!',
    typical_time: 'Closing is typically scheduled within 3–5 business days', you_need_to: 'Review your Closing Disclosure carefully and confirm your closing date and location.',
    faq: [
      { q: 'What is the Closing Disclosure?', a: 'A 5-page document listing your final loan terms, payment, and closing costs. You have a right to review it at least 3 business days before closing.' },
      { q: 'What do I bring to closing?', a: 'See your closing day checklist below.' },
    ],
  },
  closed: {
    headline: "🏡 Congratulations — you're a homeowner!", what_it_means: 'Your loan has funded and the property is yours.',
    typical_time: "N/A — you're done!", you_need_to: 'Nothing! Watch for your first mortgage statement in the next 30–45 days.',
    faq: [{ q: 'When is my first payment due?', a: 'Typically 30–45 days after closing. Your loan servicer will send instructions.' }],
  },
};

export function buildStageExplainer(stage: string, loFirstName: string): StageExplainer | null {
  const e = RAW[stage];
  if (!e) return null;
  const sub = (s: string) => s.replace(/\{lo\}/g, loFirstName || 'Your loan officer');
  return {
    headline: sub(e.headline), what_it_means: sub(e.what_it_means), typical_time: e.typical_time,
    you_need_to: sub(e.you_need_to), faq: e.faq.map((f) => ({ q: f.q, a: sub(f.a) })),
  };
}
