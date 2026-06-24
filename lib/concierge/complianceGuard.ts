/**
 * Phase 144 — outbound compliance guard for Ashley Concierge. PURE / testable.
 *
 * Conversational SMS is looser than a social post (P96 checkPostCompliance bans the
 * word "rate" outright, which a concierge legitimately needs to *defer* on), so this
 * guard is narrower and purpose-built: it blocks the AI from putting a SPECIFIC
 * offer of credit or an approval claim in an outbound text. A tripped guard does NOT
 * get sent — the engine escalates to the human loan officer instead.
 *
 * Blocks:
 *   • any percentage  (a quoted rate/APR/fee)
 *   • any dollar figure the AI states
 *   • the literal "APR" / "annual percentage rate"
 *   • a stated monthly payment
 *   • approval / guarantee language ("you're approved", "guaranteed", "qualified for")
 * Asking the borrower a qualifying question ("what's your target price range?") is
 * fine — there's no AI-stated number, so nothing trips.
 */

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

const RULES: { pattern: RegExp; reason: string }[] = [
  { pattern: /\d+\.?\d*\s*%/, reason: 'quotes a percentage (possible rate/APR/fee)' },
  { pattern: /\bAPR\b/i, reason: 'mentions APR' },
  { pattern: /annual\s+percentage\s+rate/i, reason: 'mentions annual percentage rate' },
  { pattern: /\$\s?[\d,]+(\.\d+)?/, reason: 'states a dollar figure' },
  { pattern: /\b\d[\d,]*\s*(dollars|bucks|k\b)/i, reason: 'states a dollar figure' },
  { pattern: /\$?\d[\d,]*\s*(\/|per\s*)\s*(mo|month)\b/i, reason: 'states a monthly payment' },
  { pattern: /\b(you('|’)?re|you are|you('|’)?ve been)\s+(pre[\s-]?)?(approved|qualified)\b/i, reason: 'makes an approval claim' },
  { pattern: /\b(guarantee|guaranteed|guarantees)\b/i, reason: 'makes a guarantee' },
  { pattern: /\bi can (offer|approve|give you)\b/i, reason: 'implies a personal offer of credit' },
  { pattern: /\block(ed|ing)?\s+(your|the|a)\s+rate\b/i, reason: 'references locking a rate' },
];

export function checkConciergeReply(text: string): GuardResult {
  const t = text ?? '';
  for (const { pattern, reason } of RULES) {
    if (pattern.test(t)) return { ok: false, reason: `Outbound text ${reason} — handed to the loan officer.` };
  }
  return { ok: true };
}
