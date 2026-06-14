/** Phase 132 — NMLS disclaimer footer auto-appended to every post (pure). */
import type { LOProfile } from './types';

export function buildNMLSFooter(lo: LOProfile): string {
  const parts: string[] = [`${lo.first_name} ${lo.last_name}`.trim()];
  if (lo.nmls_id) parts.push(`NMLS# ${lo.nmls_id}`);
  if (lo.licensed_states.length) parts.push(`Licensed in ${lo.licensed_states.join(', ')}`);
  if (lo.company_name) parts.push(lo.company_name + (lo.company_nmls ? ` NMLS# ${lo.company_nmls}` : ''));
  parts.push('Equal Housing Lender. This is not a commitment to lend.');
  return parts.join(' | ');
}
