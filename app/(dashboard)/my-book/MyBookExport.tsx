'use client';

/** Phase 39.1 — export the LO's personal book to CSV (download + emailed). */
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Download, Check } from 'lucide-react';

export function MyBookExport() {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  async function exportBook() {
    setBusy(true);
    try {
      const res = await fetch('/api/my-book/export', { method: 'POST' });
      const data = await res.json();
      if (res.ok && typeof data.csv === 'string') {
        const blob = new Blob([data.csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `my-book-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setDone(data.count ?? 0);
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={exportBook} disabled={busy}>
        <Download size={14} /> {busy ? 'Preparing…' : 'Download my book'}
      </Button>
      {done !== null && <span className="text-[12px] text-green inline-flex items-center gap-1"><Check size={13} /> {done} contacts exported</span>}
    </div>
  );
}
