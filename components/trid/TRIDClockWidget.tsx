'use client';

// Phase 84 — TRID countdown rings (LE + CD). Self-fetches /api/loans/[id]/trid-status.
// Business days remaining, color-coded; pulsing when critical (≤0 / overdue).

import { useEffect, useState } from 'react';
import type { TRIDColorState } from '@/lib/compliance/trid';

export const STATE_COLOR: Record<TRIDColorState, string> = {
  green: 'var(--c-green)',
  amber: 'var(--c-warning)',
  red: 'var(--c-danger)',
  critical: 'var(--c-danger)',
};

type TridStatus = {
  le_days_remaining: number | null;
  cd_days_remaining: number | null;
  le_deadline: string | null;
  cd_deadline: string | null;
  le_color: TRIDColorState | null;
  cd_color: TRIDColorState | null;
  le: string;
  cd: string;
  rate_lock: { rate: number; expiry: string | null; days_remaining: number | null; status: string } | null;
};

function CountdownRing({
  label,
  days,
  deadline,
  color,
  notApplicable,
}: {
  label: string;
  days: number | null;
  deadline: string | null;
  color: TRIDColorState | null;
  notApplicable: boolean;
}) {
  const R = 26;
  const C = 2 * Math.PI * R;
  // Fill proportion: 10+ business days = full ring, 0 = empty.
  const frac = days === null ? 0 : Math.max(0, Math.min(1, days / 10));
  const stroke = color ? STATE_COLOR[color] : 'var(--c-border)';
  const pulse = color === 'critical';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`relative ${pulse ? 'animate-pulse' : ''}`}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={R} fill="none" stroke="var(--c-border)" strokeWidth="5" />
          {!notApplicable && (
            <circle
              cx="32" cy="32" r={R} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
              transform="rotate(-90 32 32)"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {notApplicable ? (
            <span className="text-[11px] text-[var(--c-label3)]">N/A</span>
          ) : (
            <>
              <span className="text-[16px] font-bold leading-none tabular-nums" style={{ color: stroke }}>
                {days !== null && days < 0 ? '!' : days}
              </span>
              <span className="text-[8px] text-[var(--c-label3)] leading-none mt-0.5">bus. days</span>
            </>
          )}
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-medium text-[var(--c-text)]">{label}</p>
        <p className="text-[10px] text-[var(--c-label3)]">{notApplicable ? '—' : deadline ?? '—'}</p>
      </div>
    </div>
  );
}

export function TRIDClockWidget({ leadId }: { leadId: string }) {
  const [status, setStatus] = useState<TridStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/loans/${leadId}/trid-status`)
      .then((r) => r.json())
      .then((d) => { if (alive) setStatus(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [leadId]);

  if (loading) {
    return <div className="h-[110px] rounded-[12px] bg-[rgba(60,60,67,0.04)] animate-pulse" />;
  }
  if (!status) return null;

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4">
      <p className="text-[12px] font-semibold text-[var(--c-text)] mb-3">TRID delivery clock</p>
      <div className="flex items-start justify-center gap-8">
        <CountdownRing
          label="LE Deadline" days={status.le_days_remaining} deadline={status.le_deadline}
          color={status.le_color} notApplicable={status.le === 'not_applicable'}
        />
        <CountdownRing
          label="CD Deadline" days={status.cd_days_remaining} deadline={status.cd_deadline}
          color={status.cd_color} notApplicable={status.cd === 'not_applicable'}
        />
      </div>
    </div>
  );
}
