/**
 * Phase 143 — lender adapter registry. SERVER-ONLY.
 *
 * Resolves a platform key → adapter. generic_mismo is the real implementation;
 * UWM/Rocket TPO/LoanStream are structured stubs that stay GATED (nothing is
 * transmitted) until their bespoke TPO API is wired — at which point only the new
 * adapter file changes, exactly like the LoanPASS PPE stub. Each lender's TPO
 * portal also accepts a MISMO 3.4 ingest endpoint, so a tenant can use the
 * generic_mismo platform with that lender's ingest URL today.
 */
import 'server-only';
import type { LenderAdapter, SubmissionPlatform } from './types';
import { genericMismoAdapter } from './genericMismo';

/** A not-yet-wired platform: never transmits; explains how to proceed today. */
function stubAdapter(platform: SubmissionPlatform, label: string): LenderAdapter {
  const reason = `${label} has a bespoke TPO API that isn't wired yet. Use the "Generic MISMO 3.4" platform with ${label}'s MISMO ingest URL, or contact support to enable the native adapter.`;
  return {
    platform,
    async submit() { return { gated: true, status: 'queued', error: reason }; },
    async lock() { return { gated: true, status: 'requested', error: reason }; },
  };
}

const REGISTRY: Record<SubmissionPlatform, LenderAdapter> = {
  generic_mismo: genericMismoAdapter,
  custom: genericMismoAdapter, // 'custom' is generic_mismo with a hand-set endpoint
  uwm: stubAdapter('uwm', 'UWM (EDGE)'),
  rocket_tpo: stubAdapter('rocket_tpo', 'Rocket Pro TPO'),
  loanstream: stubAdapter('loanstream', 'LoanStream'),
};

export function getLenderAdapter(platform: string): LenderAdapter {
  return REGISTRY[(platform as SubmissionPlatform)] ?? genericMismoAdapter;
}
