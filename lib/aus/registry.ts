/**
 * Phase 151 — AUS vendor adapter registry. SERVER-ONLY.
 * generic = the real implementation. Fannie DU and Freddie LPA are gated stubs that
 * fall back to generic (configure their MISMO endpoint) until their native integration
 * is wired — at which point only the new adapter file changes.
 */
import 'server-only';
import type { AusAdapter, AusVendor } from './types';
import { genericAusAdapter } from './genericAus';

const REGISTRY: Partial<Record<AusVendor, AusAdapter>> = {
  generic: genericAusAdapter,
};

export function getAusAdapter(vendor: string): AusAdapter {
  return REGISTRY[vendor as AusVendor] ?? genericAusAdapter;
}
