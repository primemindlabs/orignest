'use client';

// Phase 134 — proactive soft-lock banner. Renders only when the signed-in LO is
// blocked from outbound borrower comms (no NMLS number and no exemption attested).
// Self-contained: fetches its own status, links to /settings/profile to resolve.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowRight } from 'lucide-react';

interface GateStatus {
  allowed: boolean;
  reason: string | null;
}

export function CommsGateBanner({ className = '' }: { className?: string }) {
  const [status, setStatus] = useState<GateStatus | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/me/comms-gate')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (active && j) setStatus(j as GateStatus);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!status || status.allowed) return null;

  return (
    <div
      className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-[10px] border border-orange/25 bg-orange/8 ${className}`}
    >
      <ShieldAlert size={15} className="text-orange flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-black">Add your NMLS # for compliant messaging</p>
        <p className="text-[12px] text-label-2 mt-0.5">
          {status.reason ?? 'Add your NMLS number (or mark yourself exempt) so borrower messages carry it. You can still send in the meantime.'}
        </p>
      </div>
      <Link
        href="/settings/profile"
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] bg-orange text-white text-[12px] font-semibold hover:opacity-90 transition-opacity"
      >
        Fix it <ArrowRight size={12} />
      </Link>
    </div>
  );
}
