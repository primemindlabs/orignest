/**
 * Phase 132 — lightweight, isomorphic compliance audit for social posts. Used both
 * server-side (at generation) and client-side (live, as the LO edits a post). This is
 * intentionally pure (no 'server-only') so the post card can re-check edited text.
 */

export interface ComplianceIssue {
  type: 'specific_rate' | 'guarantee_language' | 'client_reference' | 'dollar_figure';
  severity: 'high' | 'medium';
  description: string;
}

export function auditPostCompliance(text: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  if (!text) return issues;

  // Specific rate (e.g. "6.875%").
  if (/\b\d+\.\d+\s*%/.test(text)) {
    issues.push({ type: 'specific_rate', severity: 'high', description: 'Contains a specific rate — remove or generalize (e.g. "in the low-to-mid 6s").' });
  }

  // Approval / qualification guarantees.
  if (/\b(guarantee|guaranteed)\b|\byou will (qualify|be approved)\b|\bapproval guaranteed\b/i.test(text)) {
    issues.push({ type: 'guarantee_language', severity: 'high', description: 'Contains guarantee language — not allowed.' });
  }

  // Client names / testimonials.
  if (/\bmy client\b|\ba client named\b|\btestimonial\b/i.test(text)) {
    issues.push({ type: 'client_reference', severity: 'medium', description: 'References a client — ensure fully anonymized and consented.' });
  }

  return issues;
}

export const hasHighSeverity = (issues: ComplianceIssue[]) => issues.some((i) => i.severity === 'high');
