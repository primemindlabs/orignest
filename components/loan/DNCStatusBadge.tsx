'use client';

/** Phase 58.1 — DNC status badge. Shows a red "DNC" pill when a number is on the
 * internal suppression list, the national registry, or is a known litigant. Renders
 * nothing when clearly callable (keeps the header clean). */
import { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

export function DNCStatusBadge({ phone }: { phone: string | null | undefined }) {
  const [blocked, setBlocked] = useState<{ reason: string } | null>(null);
  useEffect(() => {
    if (!phone) return;
    let alive = true;
    fetch(`/api/dnc?phone=${encodeURIComponent(phone)}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!alive || !d?.result) return;
      const r = d.result;
      if (r.isInternalDNC) setBlocked({ reason: 'On your suppression list' });
      else if (r.isOnNationalRegistry === true) setBlocked({ reason: 'On national DNC registry' });
      else if (r.isLitigant === true) setBlocked({ reason: 'Known TCPA litigant' });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [phone]);

  if (!blocked) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(255,59,48,0.1)] text-[var(--c-danger)]" title={blocked.reason}>
      <ShieldAlert size={11} /> DNC
    </span>
  );
}
