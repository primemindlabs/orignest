/**
 * Phase 52.8 — MERS MIN validation/formatting. Local only, no external API.
 * A MERS MIN is exactly 18 digits.
 */
export function validateMERSMin(min: string): boolean {
  return /^\d{18}$/.test((min ?? '').replace(/\D/g, ''));
}

export function formatMERSMin(min: string): string {
  const d = (min ?? '').replace(/\D/g, '');
  return d.length === 18 ? d.replace(/(\d{7})(\d{10})(\d{1})/, '$1-$2-$3') : min;
}
