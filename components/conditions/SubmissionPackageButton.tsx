'use client';

/** Phase 49.8 — build a condition submission package (AI cover sheet + manifest). */
import { useState } from 'react';
import { FileStack } from 'lucide-react';

export function SubmissionPackageButton({ loanId }: { loanId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ cover_sheet: string; condition_count: number; document_count: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function build() {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await fetch(`/api/loans/${loanId}/submission-package`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) setErr(d.error ?? 'Could not build package.');
      else setResult(d);
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-[var(--c-text)]">Condition submission package</p>
          <p className="text-[11px] text-[var(--c-label2)]">Bundle every condition&apos;s included documents with an AI-drafted processor cover sheet.</p>
        </div>
        <button onClick={build} disabled={busy} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-[12px] font-medium bg-[var(--c-gold)] text-white hover:opacity-90 disabled:opacity-60 flex-shrink-0"><FileStack size={13} /> {busy ? 'Building…' : 'Build package'}</button>
      </div>
      {err && <p className="text-[12px] text-[var(--c-danger)] mt-2">{err}</p>}
      {result && (
        <div className="mt-3 pt-3 border-t border-[var(--c-border)]">
          <p className="text-[11px] text-[var(--c-label2)] mb-1.5">{result.document_count} documents across {result.condition_count} conditions</p>
          {result.cover_sheet && <pre className="text-[12px] text-[var(--c-text)] whitespace-pre-wrap font-sans bg-[var(--c-bg)] rounded-[8px] p-3 max-h-64 overflow-y-auto">{result.cover_sheet}</pre>}
        </div>
      )}
    </div>
  );
}
