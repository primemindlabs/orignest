'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';

// Idempotent: POST /enroll returns the existing enrollment if already enrolled.
export function EnrollCreditRepairButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      const res = await fetch('/api/credit-repair/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const j = (await res.json()) as { enrollmentId?: string; error?: string };
      if (j.enrollmentId) router.push(`/credit-repair/enrollment/${j.enrollmentId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={go}
      disabled={busy}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors disabled:opacity-50"
    >
      <ShieldCheck size={14} />
      {busy ? 'Enrolling…' : 'Credit Repair'}
    </button>
  );
}
