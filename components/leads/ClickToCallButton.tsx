'use client';

/**
 * Phase 33.9 — click-to-call from a lead card. Runs a TCPA check, then opens a
 * call. In-browser (WebRTC) calling is gated on Twilio config; until then this
 * uses a tel: link (the LO's phone) — the TCPA gate still applies.
 */
import { useState } from 'react';
import { Phone, ShieldAlert } from 'lucide-react';

export function ClickToCallButton({ leadId, phone }: { leadId: string; phone: string | null }) {
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  if (!phone) return null;

  async function call(e: React.MouseEvent) {
    e.preventDefault();
    setChecking(true);
    setBlocked(null);
    try {
      const res = await fetch('/api/dialer/tcpa-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_id: leadId }) });
      const d = await res.json();
      if (d.allowed) {
        window.location.href = `tel:${phone}`;
      } else {
        setBlocked(d.reason ?? 'Call blocked by TCPA.');
      }
    } catch {
      setBlocked('Could not verify TCPA — try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        onClick={call}
        disabled={checking}
        title="Call (TCPA-checked)"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-md bg-[var(--c-surface)] border border-[var(--c-gold)] text-[var(--c-gold-deep)] hover:bg-[var(--c-gold)] hover:text-white transition-colors disabled:opacity-50"
      >
        <Phone className="h-3.5 w-3.5" /> {checking ? 'Checking…' : 'Call'}
      </button>
      {blocked && <span className="inline-flex items-center gap-1 text-[11px] text-[var(--c-danger)] mt-1"><ShieldAlert size={11} /> {blocked}</span>}
    </span>
  );
}
