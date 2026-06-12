'use client';

// Phase 84 — full-width critical banner when a TRID deadline is ≤ 1 business day out.

import { IconAlertTriangle } from '@tabler/icons-react';

export function TRIDAlertBanner({
  type,
  deadline,
  daysRemaining,
}: {
  type: 'le' | 'cd';
  deadline: string;
  daysRemaining: number;
}) {
  const overdue = daysRemaining < 0;
  return (
    <div
      role="alert"
      className="flex items-center gap-2.5 rounded-[10px] px-4 py-3 bg-[rgba(196,114,74,0.1)] border border-[var(--c-danger)]/40 animate-pulse"
    >
      <IconAlertTriangle size={18} className="text-[var(--c-danger)] flex-shrink-0" />
      <p className="text-[13px] text-[var(--c-text)]">
        <strong className="text-[var(--c-danger)]">TRID Alert:</strong> {type.toUpperCase()} deadline{' '}
        {overdue ? (
          <>was <strong>{deadline}</strong> — <strong>{Math.abs(daysRemaining)} business day{Math.abs(daysRemaining) === 1 ? '' : 's'} overdue</strong>.</>
        ) : (
          <>is <strong>{deadline}</strong> — <strong>{daysRemaining} business day{daysRemaining === 1 ? '' : 's'} remaining</strong>.</>
        )}{' '}
        Action required.
      </p>
    </div>
  );
}
