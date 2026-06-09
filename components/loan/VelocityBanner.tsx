'use client';

/**
 * Phase 30.6 — Pipeline Velocity banner shown on the loan overview page.
 * Color-coded by risk; shows predicted close + the top risk factor + the LO action.
 */
import { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, AlertOctagon, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface VelocityRow {
  predicted_close_date: string;
  confidence_interval_days: number;
  days_behind_typical: number;
  risk_level: 'on_track' | 'watch' | 'at_risk' | 'critical';
  risk_factors: Array<{ factor: string; impact_days: number; description: string }>;
  recommendation: string | null;
  generated_at: string;
}

const RISK_META: Record<VelocityRow['risk_level'], { label: string; tone: string; bg: string; border: string; Icon: typeof CheckCircle2 }> = {
  on_track: { label: 'On Track', tone: 'var(--c-success)', bg: 'rgba(52,199,89,0.06)', border: 'rgba(52,199,89,0.28)', Icon: CheckCircle2 },
  watch: { label: 'Watch', tone: 'var(--c-warning)', bg: 'rgba(255,149,0,0.06)', border: 'rgba(255,149,0,0.28)', Icon: Eye },
  at_risk: { label: 'At Risk', tone: 'var(--c-danger)', bg: 'rgba(255,59,48,0.06)', border: 'rgba(255,59,48,0.28)', Icon: AlertTriangle },
  critical: { label: 'Critical', tone: 'var(--c-danger)', bg: 'rgba(255,59,48,0.10)', border: 'rgba(255,59,48,0.40)', Icon: AlertOctagon },
};

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function VelocityBanner({ loanId, initial }: { loanId: string; initial: VelocityRow | null }) {
  const [pred, setPred] = useState<VelocityRow | null>(initial);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch(`/api/loans/${loanId}/velocity`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.prediction) setPred(data.prediction);
    } finally {
      setBusy(false);
    }
  }

  if (!pred) {
    return (
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--c-label2)]">No close-date prediction yet.</p>
        <Button variant="secondary" onClick={refresh} disabled={busy}>
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Predicting…' : 'Predict Close Date'}
        </Button>
      </div>
    );
  }

  const meta = RISK_META[pred.risk_level];
  const topFactor = pred.risk_factors[0];
  const behind = pred.days_behind_typical;

  return (
    <div className="rounded-[14px] border px-4 py-3" style={{ background: meta.bg, borderColor: meta.border }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <meta.Icon size={18} className="flex-shrink-0 mt-0.5" style={{ color: meta.tone }} />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--c-text)]">
              <span style={{ color: meta.tone }}>{meta.label}</span>
              {' · '}Predicted close: {fmtDate(pred.predicted_close_date)} ± {pred.confidence_interval_days} days
              {behind > 0 && <span className="text-[var(--c-label2)] font-normal"> ({behind} days behind typical)</span>}
              {behind < 0 && <span className="text-[var(--c-label2)] font-normal"> ({Math.abs(behind)} days ahead)</span>}
            </p>
            {topFactor && (
              <p className="text-[12px] text-[var(--c-label2)] mt-0.5 leading-snug">{topFactor.description || topFactor.factor}</p>
            )}
            {pred.recommendation && (
              <p className="text-[12px] text-[var(--c-text)] mt-1 leading-snug">→ {pred.recommendation}</p>
            )}
          </div>
        </div>
        <Button variant="ghost" onClick={refresh} disabled={busy} className="flex-shrink-0">
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
          {busy ? 'Updating…' : 'Update'}
        </Button>
      </div>
    </div>
  );
}
