import { Archive } from 'lucide-react';

/**
 * Phase 88 — shown in every channel header. Non-dismissible: team chat messages are
 * permanent compliance records (no edit / no delete) for RESPA/CFPB audit readiness.
 */
export function ComplianceArchivedBanner() {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-[var(--c-label2)] bg-[var(--c-fill)] rounded-[8px] px-2.5 py-1.5">
      <Archive size={12} className="flex-shrink-0 text-[var(--c-gold-deep)]" />
      <span>All messages here are compliance-archived and cannot be edited or deleted.</span>
    </div>
  );
}
