// Phase 84 — rate-lock countdown chip. Days remaining + locked rate, color by urgency.
// Reads from rate_lock_expirations (no separate rate_lock_alerts table).

import { IconLock } from '@tabler/icons-react';

export function RateLockCountdown({
  lockedRate,
  daysRemaining,
}: {
  lockedRate: number;
  daysRemaining: number;
}) {
  const color =
    daysRemaining <= 2 ? 'var(--c-danger)' : daysRemaining <= 5 ? 'var(--c-warning)' : 'var(--c-green)';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <IconLock size={12} />
      {lockedRate}% locked ·{' '}
      {daysRemaining < 0 ? `expired ${Math.abs(daysRemaining)}d ago` : `${daysRemaining}d remaining`}
    </span>
  );
}
