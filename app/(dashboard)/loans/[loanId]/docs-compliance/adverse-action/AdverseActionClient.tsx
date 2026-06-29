'use client';

import { useState } from 'react';
import { ECOA_DENIAL_REASONS } from '@/lib/ecoa/reasons';

const ECOA_DEADLINE_DAYS = 30;

export function AdverseActionClient({ loanId }: { loanId: string }) {
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [actionTaken, setActionTaken] = useState<'denied' | 'counteroffer' | 'incomplete'>('denied');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  function toggleReason(r: string) {
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : prev.length >= 4 ? prev : [...prev, r]));
  }

  async function generatePdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/adverse-action/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasons, actionTaken }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setPdfError(j.error ?? 'Could not generate the notice.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adverse-action-${loanId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setPdfError('Network error — could not generate the notice.');
    } finally {
      setPdfBusy(false);
    }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch('/api/ai/loan-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: loanId, draft_type: 'adverse_action' }),
      });
      const data = (await res.json().catch(() => ({}))) as { draft?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not generate the notice. Try again.');
        return;
      }
      setDraft(data.draft ?? '');
    } catch {
      setError('Network error — could not reach the drafting service.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-3">
        <div>
          <p className="text-[15px] font-semibold text-[var(--c-text)]">Generate Notice PDF (Reg B)</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 leading-relaxed max-w-md">
            Select up to 4 principal reasons from the ECOA approved list, then generate the formatted
            &ldquo;Notice of Action Taken&rdquo; PDF. A record is logged for the compliance audit trail.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--c-label2)] mb-1 block">Action taken</span>
            <select
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value as 'denied' | 'counteroffer' | 'incomplete')}
              className="h-9 px-2.5 rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[13px] text-[var(--c-text)] w-full"
            >
              <option value="denied">Denied</option>
              <option value="counteroffer">Counteroffer</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </label>
          <div className="flex items-end text-[12px] text-[var(--c-label3)]">{reasons.length}/4 reasons selected</div>
        </div>
        <div className="max-h-48 overflow-y-auto border border-[var(--c-border)] rounded-[10px] p-2 space-y-1">
          {ECOA_DENIAL_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-[13px] text-[var(--c-text)] cursor-pointer">
              <input type="checkbox" checked={reasons.includes(r)} onChange={() => toggleReason(r)} disabled={!reasons.includes(r) && reasons.length >= 4} />
              {r}
            </label>
          ))}
        </div>
        {pdfError && <div className="text-[13px] text-[var(--c-danger)]">{pdfError}</div>}
        <button
          onClick={generatePdf}
          disabled={pdfBusy || reasons.length === 0}
          className="text-[13px] font-semibold rounded-[10px] px-4 py-2 bg-[var(--c-text)] text-[var(--c-surface)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {pdfBusy ? 'Generating…' : 'Generate Notice PDF'}
        </button>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold text-[var(--c-text)]">AI draft (free-text)</p>
            <p className="text-[13px] text-[var(--c-label2)] mt-1 leading-relaxed max-w-md">
              Produces an ECOA-compliant notice shell with bracketed placeholders for the specific
              reasons. Review and fill in the principal reasons before sending — within{' '}
              {ECOA_DEADLINE_DAYS} days of the credit decision.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="shrink-0 text-[13px] font-semibold rounded-[10px] px-4 py-2 bg-[var(--c-gold-deep)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Drafting…' : draft ? 'Regenerate' : 'Generate draft'}
          </button>
        </div>

        {error && (
          <div className="text-[13px] text-[var(--c-danger)] bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[10px] px-3 py-2">
            {error}
          </div>
        )}
      </div>

      {draft && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-[var(--c-label2)] uppercase tracking-wide">Draft notice</p>
            <button
              onClick={copy}
              className="text-[12px] font-medium text-[var(--c-gold-deep)] hover:underline"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={18}
            className="w-full text-[13px] leading-relaxed text-[var(--c-text)] bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[10px] p-3 font-mono resize-y focus:outline-none focus:ring-1 focus:ring-[var(--c-gold-deep)]"
          />
          <p className="text-[12px] text-[var(--c-label3)] leading-relaxed">
            This is an AI-generated draft, not legal advice. Replace every [bracket], confirm the
            principal reasons match the credit decision, and have it reviewed per your compliance policy
            before delivery.
          </p>
        </div>
      )}
    </div>
  );
}
