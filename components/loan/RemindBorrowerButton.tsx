'use client';

// Phase 113 — "Remind borrower" of outstanding conditions (TCPA-gated server-side).
import { useState } from 'react';
import { Bell } from 'lucide-react';

export function RemindBorrowerButton({ loanId, outstandingCount }: { loanId: string; outstandingCount: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (outstandingCount === 0) return null;

  async function remind() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/conditions/remind`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg(data.error ?? 'Could not send reminder');
      else if (data.reminded === 0) setMsg(data.message ?? 'Nothing outstanding');
      else setMsg(`Reminder sent (${data.channel?.toUpperCase()}) for ${data.reminded} item${data.reminded === 1 ? '' : 's'}.`);
    } catch {
      setMsg('Could not send reminder');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={remind}
        disabled={busy}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors disabled:opacity-50"
      >
        <Bell size={13} className="text-[var(--c-gold-deep)]" />
        {busy ? 'Sending…' : `Remind borrower (${outstandingCount})`}
      </button>
      {msg && <span className="text-[11px] text-[var(--c-label2)]">{msg}</span>}
    </div>
  );
}
