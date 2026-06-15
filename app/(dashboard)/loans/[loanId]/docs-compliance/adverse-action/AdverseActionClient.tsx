'use client';

import { useState } from 'react';

const ECOA_DEADLINE_DAYS = 30;

export function AdverseActionClient({ loanId }: { loanId: string }) {
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[15px] font-semibold text-[var(--c-text)]">Generate Adverse Action Notice</p>
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
