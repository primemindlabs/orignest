// Phase 86 — Refi blast constants + pure helpers.
//
// RESPA COMPLIANCE: this disclaimer is a hardcoded module constant. It is appended by the
// SERVER to every blast message (never assembled on the client) and is rendered read-only
// in the UI with a lock icon. Do not make it editable or removable.

export const RESPA_DISCLAIMER =
  'This is not a commitment to lend. Refinancing may result in higher total finance charges. Your actual rate and payment will depend on your credit profile and the loan terms available at that time. Rates shown are subject to change without notice.' as const;

export const RESPA_DISCLAIMER_VERSION = '2024-v1' as const;

export const DEFAULT_REFI_THRESHOLD = 0.375;
export const MIN_REFI_THRESHOLD = 0.25;

/** A loan is a refi candidate when the current market rate is at least `threshold` below it. */
export function isRefiCandidate(originalRate: number, currentRate: number, threshold: number = DEFAULT_REFI_THRESHOLD): boolean {
  return currentRate <= originalRate - threshold;
}

/** Rough monthly savings estimate (per the spec's simplified formula). */
export function estimateMonthlySavings(originalRate: number, currentRate: number, loanBalance: number): number {
  const rateDiff = (originalRate - currentRate) / 100;
  return Math.round((rateDiff / 12) * loanBalance * 100) / 100;
}

/** Fill {first_name} / {rate_savings} merge fields. Unknown fields are left intact. */
export function interpolateTemplate(template: string, vars: { first_name?: string; rate_savings?: string | number }): string {
  return template
    .replace(/\{first_name\}/g, String(vars.first_name ?? 'there'))
    .replace(/\{rate_savings\}/g, vars.rate_savings != null ? `$${vars.rate_savings}` : '');
}

/** Server-authoritative full message: interpolated body + the mandatory RESPA disclaimer. */
export function buildBlastMessage(template: string, vars: { first_name?: string; rate_savings?: string | number }): string {
  return `${interpolateTemplate(template, vars)}\n\n${RESPA_DISCLAIMER}`;
}
