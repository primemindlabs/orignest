'use client';

/**
 * Phase 138 — pervasive, non-blocking NMLS nudge. The NMLS gate no longer blocks
 * sends (warning-only); this keeps the prompt visible everywhere until the LO adds
 * their number (or marks exempt), so it's captured early without ever being a wall.
 * Dismissible for the day.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, X } from 'lucide-react';

const DISMISS_KEY = 'nmls_nudge_dismissed';

export function NmlsNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Snooze for the day if dismissed.
    try {
      if (localStorage.getItem(DISMISS_KEY) === new Date().toDateString()) return;
    } catch {
      /* ignore */
    }
    let active = true;
    fetch('/api/me/comms-gate')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (active && s && s.allowed === false) setShow(true);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toDateString());
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-2 bg-gold-50 border-b border-gold-100 text-[13px]">
      <ShieldAlert className="w-4 h-4 text-gold-700 flex-shrink-0" />
      <p className="flex-1 text-gold-800">
        Add your <strong>NMLS #</strong> so your borrower messages stay compliant.
        <Link href="/settings/profile" className="font-semibold underline ml-1 hover:text-gold-900">Add it now</Link>
        <span className="text-gold-700"> · or mark yourself exempt</span>
      </p>
      <button onClick={dismiss} className="text-gold-700 hover:text-gold-900 flex-shrink-0" aria-label="Dismiss for today">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
