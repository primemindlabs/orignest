/**
 * Phase 96 — social closing-post compliance pre-filter (Reg Z / UDAP).
 * Pure function (no deps) so it runs identically on the server (generate/approve)
 * and the client (live as the LO types). Blocks any "specific offer of credit":
 * rates, percentages, dollar figures, payment/interest language.
 */
import type { ComplianceCheckResult } from '@/types/closingPosts';

interface ComplianceFlag {
  pattern: RegExp;
  message: string;
}

const FORBIDDEN_PATTERNS: ComplianceFlag[] = [
  { pattern: /\d+\.?\d*\s*%/g, message: 'Contains a percentage — remove any rate or fee reference' },
  { pattern: /\$[\d,]+/g, message: 'Contains a dollar amount — remove all monetary figures' },
  { pattern: /\b(rate|rates)\b/gi, message: 'Contains the word "rate" — not permitted in social posts' },
  { pattern: /\bAPR\b/gi, message: 'Contains "APR" — not permitted in social posts' },
  { pattern: /monthly\s+payment/gi, message: 'Contains "monthly payment" — not permitted in social posts' },
  { pattern: /annual\s+percentage/gi, message: 'Contains "annual percentage" — not permitted in social posts' },
  { pattern: /\d[\d,]*\s*(dollars?|k\b)/gi, message: 'Contains a numeric dollar reference — remove monetary figures' },
  { pattern: /loan\s+amount/gi, message: 'Contains "loan amount" — not permitted' },
  { pattern: /down\s+payment/gi, message: 'Contains "down payment" — not permitted' },
  { pattern: /purchase\s+price/gi, message: 'Contains "purchase price" — not permitted' },
  { pattern: /\binterest\b/gi, message: 'Contains "interest" — avoid any interest-related language' },
];

export function checkPostCompliance(copy: string): ComplianceCheckResult {
  const flags: string[] = [];
  const flagged_terms: { term: string; context: string }[] = [];

  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    const matches = Array.from(copy.matchAll(pattern));
    if (matches.length > 0) {
      flags.push(message);
      for (const match of matches) {
        const at = match.index ?? 0;
        const start = Math.max(0, at - 20);
        const end = Math.min(copy.length, at + match[0].length + 20);
        flagged_terms.push({ term: match[0], context: `…${copy.slice(start, end)}…` });
      }
    }
  }

  return { passed: flags.length === 0, flags, flagged_terms };
}
