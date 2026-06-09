'use client';

/**
 * Phase 30.1 — AI Condition Preview card.
 * Shows Claude's predicted UW conditions with gold probability bars (DM Mono %).
 * Lives above the conditions table on the underwriting landing page.
 */
import { useState } from 'react';
import { Sparkles, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface PredictionRow {
  id: string;
  generated_at: string;
  model_version: string;
  predictions: Array<{
    condition_text: string;
    category: string;
    probability: number;
    reasoning?: string;
    source?: string;
  }>;
  lo_reviewed: boolean;
  lo_reviewed_at: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ConditionPreviewCard({
  loanId,
  initial,
  rollingAccuracy,
  accuracySampleSize,
  patternLoanCount,
}: {
  loanId: string;
  initial: PredictionRow | null;
  rollingAccuracy: number | null;
  accuracySampleSize: number;
  patternLoanCount: number;
}) {
  const [prediction, setPrediction] = useState<PredictionRow | null>(initial);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [basisCount, setBasisCount] = useState(patternLoanCount);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/predict-conditions`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate');
      setPrediction(data.prediction);
      if (typeof data.basedOnPattern === 'number') setBasisCount(data.basedOnPattern);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate predictions');
    } finally {
      setBusy(false);
    }
  }

  async function markReviewed() {
    if (!prediction) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/predict-conditions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_reviewed' }),
      });
      if (res.ok) {
        setPrediction({ ...prediction, lo_reviewed: true, lo_reviewed_at: new Date().toISOString() });
      }
    } finally {
      setReviewing(false);
    }
  }

  const preds = prediction?.predictions ?? [];

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-[8px] bg-[var(--c-gold-light)] flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} className="text-[var(--c-gold-deep)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--c-text)] leading-tight">AI Condition Preview</p>
            <p className="text-[11px] text-[var(--c-label2)] leading-tight">
              {prediction
                ? `Generated ${fmtDate(prediction.generated_at)}${basisCount > 0 ? ` · ${basisCount} similar funded loans` : ' · loan profile + program guidelines'}`
                : 'Predict conditions before you submit to underwriting'}
            </p>
          </div>
        </div>
        {rollingAccuracy != null && accuracySampleSize > 0 && (
          <div className="text-right flex-shrink-0">
            <p className="text-[15px] font-mono tabular-nums font-semibold text-[var(--c-gold-deep)] leading-none">{rollingAccuracy}%</p>
            <p className="text-[10px] text-[var(--c-label2)]">accuracy · last {accuracySampleSize}</p>
          </div>
        )}
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {preds.length === 0 && (
          <p className="text-[12px] text-[var(--c-label2)] py-2">
            {prediction
              ? 'No conditions predicted above the 40% threshold for this profile.'
              : 'No prediction yet. Generate one to see what underwriting is likely to ask for.'}
          </p>
        )}

        {preds.map((p, i) => {
          const pct = Math.round(p.probability * 100);
          return (
            <div key={i} className="group">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-mono tabular-nums text-[var(--c-text)] w-9 text-right flex-shrink-0">{pct}%</span>
                <div className="h-2 rounded-full bg-[var(--c-fill)] flex-1 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--c-gold)' }} />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-1 pl-12">
                <p className="text-[12px] text-[var(--c-text)] leading-snug">{p.condition_text}</p>
                <span className="text-[10px] uppercase tracking-wide text-[var(--c-label2)] flex-shrink-0">{p.category}</span>
              </div>
              {p.reasoning && (
                <p className="text-[11px] text-[var(--c-label2)] leading-snug mt-0.5 pl-12">{p.reasoning}</p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="px-4 pb-2 text-[12px] text-[var(--c-danger)]">{error}</p>}

      <div className="px-4 py-3 border-t border-[var(--c-border)] flex items-center gap-2">
        <Button variant="secondary" onClick={refresh} disabled={busy}>
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Generating…' : prediction ? 'Refresh Predictions' : 'Generate Predictions'}
        </Button>
        {prediction && !prediction.lo_reviewed && (
          <Button variant="ghost" onClick={markReviewed} disabled={reviewing}>
            <Check size={13} />
            Mark as Reviewed
          </Button>
        )}
        {prediction?.lo_reviewed && (
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--c-gold-deep)]">
            <Check size={13} /> Reviewed
          </span>
        )}
      </div>
    </div>
  );
}
