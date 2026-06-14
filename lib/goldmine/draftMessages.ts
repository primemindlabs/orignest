/** Phase 131 — pre-written outreach drafts per signal (NMLS disclaimer appended at send). */
import type { GoldmineSignalType } from './types';

export interface Draft {
  sms: string;
  subject: string;
  body: string;
}

const sign = (lo: string) => `— ${lo}`;

export function buildDraft(
  signal: GoldmineSignalType,
  firstName: string,
  loFirst: string,
  facts: { savings?: number; equityK?: number; years?: number; months?: number; closeYear?: string },
): Draft {
  const fn = firstName || 'there';
  switch (signal) {
    case 'pre_approval_expired':
      return {
        sms: `Hi ${fn}, it's been a few months since we talked about your home purchase. Still looking? Rates have moved and I'd love to get you a fresh pre-approval. ${sign(loFirst)}`,
        subject: 'Still house hunting? Let’s refresh your pre-approval',
        body: `Hi ${fn},\n\nIt's been a little while since we last talked about your home purchase. If you're still in the market, a lot has changed — and I'd be happy to get you an updated pre-approval so you're ready to move when the right home shows up.\n\nWant me to refresh it?\n\n${sign(loFirst)}`,
      };
    case 'rate_improvement':
      return {
        sms: `Hi ${fn}! Rates have dropped since your ${facts.closeYear ?? ''} closing — you may save about $${facts.savings ?? 0}/mo with a refi. Want me to run the numbers? ${sign(loFirst)}`,
        subject: 'You may be able to lower your mortgage payment',
        body: `Hi ${fn},\n\nRates have come down noticeably since your loan closed${facts.closeYear ? ` in ${facts.closeYear}` : ''}. Based on a quick estimate, a refinance could save you around $${facts.savings ?? 0}/month.\n\nWant me to run an exact, no-obligation analysis for you?\n\n${sign(loFirst)}`,
      };
    case 'equity_milestone':
      return {
        sms: `Hi ${fn}! Your home value has grown — you may have around $${facts.equityK ?? 0}K in accessible equity. Worth a quick call to explore your options? ${sign(loFirst)}`,
        subject: 'You’ve built significant home equity',
        body: `Hi ${fn},\n\nGood news — home values in your area have climbed, and you may now have roughly $${facts.equityK ?? 0}K in accessible equity. Whether it's a HELOC, a cash-out refinance, or just understanding your options, I'm happy to walk you through it.\n\nWorth a quick call?\n\n${sign(loFirst)}`,
      };
    case 'loan_anniversary':
      return {
        sms: `Hi ${fn}! Can you believe it's been ${facts.years ?? 1} year${(facts.years ?? 1) > 1 ? 's' : ''} in your home? 🏡 Congratulations! I'm always here if you ever want to review your options. ${sign(loFirst)}`,
        subject: `Happy ${facts.years ?? 1}-year home anniversary! 🏡`,
        body: `Hi ${fn},\n\nHappy ${facts.years ?? 1}-year home anniversary! It's been a privilege to be your loan officer. If you ever want to review your mortgage, tap into equity, or help someone you know, I'm only a message away.\n\nCongratulations again!\n\n${sign(loFirst)}`,
      };
    case 'long_inactive':
    default:
      return {
        sms: `Hi ${fn}, just reaching out to say hi! If you or anyone you know is thinking about buying, selling, or refinancing, I'd love to help. Hope you're well! ${sign(loFirst)}`,
        subject: 'Just checking in',
        body: `Hi ${fn},\n\nIt's been a while — I just wanted to reach out and say hello. If you, or anyone you know, is thinking about buying, selling, or refinancing, I'd be glad to help.\n\nHope you're doing well!\n\n${sign(loFirst)}`,
      };
  }
}
