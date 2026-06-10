'use client';

/** Phase 66 — TCPA calling-window badge. Shows ONLY when it's outside the borrower's
 * 8am-9pm local window (or state unknown). Renders nothing when sending is fine. */
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function TcpaWindowBadge({ leadId }: { leadId: string }) {
  const [blocked, setBlocked] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/communications/tcpa-check?lead_id=${leadId}`).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!alive || !d?.window) return;
      if (!d.window.allowed) setBlocked(d.window.reason ?? 'Outside calling hours');
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [leadId]);

  if (!blocked) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgba(243,156,18,0.12)] text-[#B45309]" title={blocked}>
      <Clock size={11} /> Outside calling hours
    </span>
  );
}
