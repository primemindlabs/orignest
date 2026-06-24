/**
 * Phase 147 — credit vendor adapter registry. SERVER-ONLY.
 * generic = the real implementation. Named vendors are gated stubs that fall back to
 * generic (configure their JSON endpoint) until their native MISMO/proprietary
 * integration is wired — at which point only the new adapter file changes.
 */
import 'server-only';
import type { CreditAdapter, CreditVendor } from './types';
import { genericCreditAdapter } from './genericCredit';

const REGISTRY: Partial<Record<CreditVendor, CreditAdapter>> = {
  generic: genericCreditAdapter,
};

export function getCreditAdapter(vendor: string): CreditAdapter {
  return REGISTRY[vendor as CreditVendor] ?? genericCreditAdapter;
}
