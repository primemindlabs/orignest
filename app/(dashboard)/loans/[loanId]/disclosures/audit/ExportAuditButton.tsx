'use client';

import { useState } from 'react';

export function ExportAuditButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/compliance/data-export', { method: 'GET' });
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.message ?? 'You can request one export every 24 hours.');
        return;
      }
      if (!res.ok) {
        setMsg('Export failed. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg('Export downloaded.');
    } catch {
      setMsg('Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0 text-right">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="text-[13px] font-semibold px-4 py-2 rounded-[10px] border transition disabled:opacity-50"
        style={{
          color: 'var(--c-gold-deep)',
          borderColor: 'var(--c-border)',
          background: 'var(--c-fill)',
        }}
      >
        {busy ? 'Exporting…' : 'Export audit trail'}
      </button>
      {msg && <p className="text-[11px] text-[var(--c-label2)] mt-1.5 max-w-[180px]">{msg}</p>}
    </div>
  );
}
