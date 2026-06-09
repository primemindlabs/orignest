'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SmartField } from '@/components/ui/SmartField';
import { Check, X } from 'lucide-react';

interface Factor { label: string; points: number }

export function RiskPanel({
  loanId,
  suggested,
  factors,
  initialScore,
}: {
  loanId: string;
  suggested: number;
  factors: Factor[];
  initialScore: number | null;
}) {
  const [override, setOverride] = useState<number | null>(initialScore != null && initialScore !== suggested ? initialScore : null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const score = override ?? suggested;
  const tone = score <= 25 ? 'var(--c-success)' : score <= 50 ? 'var(--c-warning)' : 'var(--c-danger)';
  const band = score <= 25 ? 'Low risk' : score <= 50 ? 'Moderate risk' : score <= 75 ? 'Elevated risk' : 'High risk';

  async function save() {
    setSaving(true); setStatus(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/underwriting`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'uw', risk_score: score, risk_factors: factors }),
      });
      setStatus(res.ok ? { ok: true, msg: 'Saved.' } : { ok: false, msg: 'Save failed.' });
    } catch { setStatus({ ok: false, msg: 'Network error.' }); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tone, opacity: 0.95 }}>
            <span className="text-[24px] font-bold text-white tabular-nums">{score}</span>
          </div>
          <div>
            <p className="text-[15px] font-semibold" style={{ color: tone }}>{band}</p>
            <p className="text-[12px] text-[var(--c-label2)]">0 = lowest risk · 100 = highest</p>
          </div>
        </div>
        <div className="mt-4 max-w-[240px]">
          <SmartField
            label="Risk score"
            value={score}
            format="integer"
            isAutoCalculated={override == null}
            formula="layered DTI + credit + LTV model"
            onOverride={(v) => setOverride(Number(v))}
            onClearOverride={() => setOverride(null)}
          />
        </div>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <h3 className="text-[13px] font-semibold text-[var(--c-text)] mb-3">Contributing factors</h3>
        <div className="divide-y divide-[var(--c-border)]">
          {factors.map((f) => (
            <div key={f.label} className="flex items-center justify-between py-2">
              <span className="text-[13px] text-[var(--c-text)]">{f.label}</span>
              <span className="text-[13px] font-mono tabular-nums" style={{ color: f.points > 0 ? 'var(--c-danger)' : 'var(--c-label3)' }}>
                {f.points > 0 ? `+${f.points}` : '0'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 justify-end">
        {status && (
          <span className={`inline-flex items-center gap-1.5 text-[13px] ${status.ok ? 'text-[var(--c-success)]' : 'text-[var(--c-danger)]'}`}>
            {status.ok ? <Check size={14} /> : <X size={14} />} {status.msg}
          </span>
        )}
        <Button onClick={save} loading={saving}>Save risk score</Button>
      </div>
    </div>
  );
}
