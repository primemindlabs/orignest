/**
 * Phase 61.2 — Text-to-Apply SMS pre-qual state machine. PURE (no DB / no Twilio).
 * 5 questions + name/email collection. processReply() returns the next state, what
 * to store, and the next outbound message — the webhook layer handles send + persist.
 */
export type TtaState =
  | 'awaiting_consent' | 'q1_purpose' | 'q2_price' | 'q3_credit' | 'q4_employment' | 'q5_timeline'
  | 'collecting_name' | 'collecting_email' | 'completed' | 'opted_out' | 'abandoned';

interface Opt { value: string; next: TtaState }
interface Question { message: string; options?: Record<string, Opt>; freeText?: boolean; allowSkip?: boolean; next?: TtaState; fallback: string; parse?: (s: string) => string | null; key: string }

export const parseDollarAmount = (s: string): string | null => { const n = s.replace(/[$,\s]/gi, '').replace(/k$/i, '000'); const v = Number(n); return Number.isFinite(v) && v > 0 ? String(Math.round(v)) : null; };
const parseEmail = (s: string): string | null => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim()) ? s.trim() : null;
const parseName = (s: string): string | null => s.trim().length >= 2 ? s.trim() : null;

export const TTA_QUESTIONS: Partial<Record<TtaState, Question>> = {
  q1_purpose: { key: 'purpose', message: 'Are you looking to (1) Purchase a new home or (2) Refinance your current home?', options: { '1': { value: 'purchase', next: 'q2_price' }, '2': { value: 'refinance', next: 'q2_price' }, purchase: { value: 'purchase', next: 'q2_price' }, refinance: { value: 'refinance', next: 'q2_price' } }, fallback: 'Reply 1 for Purchase or 2 for Refinance.' },
  q2_price: { key: 'loan_amount', message: 'What is the approximate loan amount you need? (e.g. 350000 or $350k)', freeText: true, parse: parseDollarAmount, next: 'q3_credit', fallback: 'Please enter a loan amount, like 350000 or $350k.' },
  q3_credit: { key: 'credit', message: 'Estimated credit score range?\n1) 760+\n2) 720-759\n3) 680-719\n4) 640-679\n5) Below 640', options: { '1': { value: 'excellent_760_plus', next: 'q4_employment' }, '2': { value: 'good_720_759', next: 'q4_employment' }, '3': { value: 'fair_680_719', next: 'q4_employment' }, '4': { value: 'poor_640_679', next: 'q4_employment' }, '5': { value: 'challenged_below_640', next: 'q4_employment' } }, fallback: 'Reply 1-5 to select your credit range.' },
  q4_employment: { key: 'employment', message: 'Employment?\n1) W-2 Employee\n2) Self-Employed\n3) Retired\n4) Other', options: { '1': { value: 'w2', next: 'q5_timeline' }, '2': { value: 'self_employed', next: 'q5_timeline' }, '3': { value: 'retired', next: 'q5_timeline' }, '4': { value: 'other', next: 'q5_timeline' } }, fallback: 'Reply 1-4 for employment type.' },
  q5_timeline: { key: 'timeline', message: 'Timeline?\n1) Ready now (0-30 days)\n2) 1-3 months\n3) 3-6 months\n4) Just exploring', options: { '1': { value: 'ready_now', next: 'collecting_name' }, '2': { value: '1_3_months', next: 'collecting_name' }, '3': { value: '3_6_months', next: 'collecting_name' }, '4': { value: 'exploring', next: 'collecting_name' } }, fallback: 'Reply 1-4 for your timeline.' },
  collecting_name: { key: 'name', message: 'What is your full name?', freeText: true, parse: parseName, next: 'collecting_email', fallback: 'Please reply with your full name.' },
  collecting_email: { key: 'email', message: 'What is your email address? (Reply SKIP to skip)', freeText: true, allowSkip: true, parse: parseEmail, next: 'completed', fallback: 'Please enter a valid email or reply SKIP.' },
};

export const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);

export interface ProcessResult { kind: 'reask' | 'advance' | 'complete' | 'opt_out'; nextState?: TtaState; storeKey?: string; storeValue?: string; outboundMessage?: string }

/** Process a borrower reply for a given state. */
export function processReply(state: TtaState, reply: string): ProcessResult {
  const r = reply.trim();
  if (STOP_WORDS.has(r.toUpperCase())) return { kind: 'opt_out' };
  const q = TTA_QUESTIONS[state];
  if (!q) return { kind: 'reask', outboundMessage: '' };

  if (q.allowSkip && r.toUpperCase() === 'SKIP') {
    const next = q.next ?? 'completed';
    return next === 'completed' ? { kind: 'complete', storeKey: q.key, storeValue: '' } : { kind: 'advance', nextState: next, outboundMessage: TTA_QUESTIONS[next]?.message };
  }
  if (q.options) {
    const m = q.options[r.toLowerCase()] ?? q.options[r];
    if (!m) return { kind: 'reask', outboundMessage: q.fallback };
    if (m.next === 'completed') return { kind: 'complete', storeKey: q.key, storeValue: m.value };
    return { kind: 'advance', nextState: m.next, storeKey: q.key, storeValue: m.value, outboundMessage: TTA_QUESTIONS[m.next]?.message };
  }
  if (q.freeText) {
    const v = q.parse ? q.parse(r) : r;
    if (!v) return { kind: 'reask', outboundMessage: q.fallback };
    const next = q.next ?? 'completed';
    if (next === 'completed') return { kind: 'complete', storeKey: q.key, storeValue: v };
    return { kind: 'advance', nextState: next, storeKey: q.key, storeValue: v, outboundMessage: TTA_QUESTIONS[next]?.message };
  }
  return { kind: 'reask', outboundMessage: q.fallback };
}
