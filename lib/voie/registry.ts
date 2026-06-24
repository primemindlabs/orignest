/**
 * Phase 150 — VOI/VOE vendor adapter registry. SERVER-ONLY.
 * generic = the real implementation. Named vendors (Truework, The Work Number,
 * Plaid Income) are gated stubs that fall back to generic (configure their JSON
 * endpoint) until their native integration is wired — at which point only the new
 * adapter file changes.
 */
import 'server-only';
import type { VoieAdapter, VoieVendor } from './types';
import { genericVoieAdapter } from './genericVoie';

const REGISTRY: Partial<Record<VoieVendor, VoieAdapter>> = {
  generic: genericVoieAdapter,
};

export function getVoieAdapter(vendor: string): VoieAdapter {
  return REGISTRY[vendor as VoieVendor] ?? genericVoieAdapter;
}
