'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SmartField } from '@/components/ui/SmartField';
import { Check, X } from 'lucide-react';

interface DtiRow {
  total_monthly_income: number;
  proposed_housing_payment: number;
  other_monthly_debts: number;
  front_end_dti: number | null;
  back_end_dti: number | null;
  overrides: Record<string, unknown>;
}

function compute(income: number, housing: number, debts: number) {
  if (income <= 0) return { front: null as number | null, back: null as number | null };
  return {
    front: Math.round((housing / income) * 1000) / 10,
    back: Math.round(((housing + debts) / income) * 1000) / 10,
  };
}

export function DtiWorksheet({ loanId, initial }: { loanId: string; initial: DtiRow }) {
  const [income, setIncome] = useState(String(initial.total_monthly_income || ''));
  const [housing, setHousing] = useState(String(initial.proposed_housing_payment || ''));
  const [debts, setDebts] = useState(String(initial.other_monthly_debts || ''));
  const [overrides, setOverrides] = useState<Record<string, unknown>>(initial.overrides ?? {});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const auto = compute(Number(income) || 0, Number(housing) || 0, Number(debts) || 0);
  const frontOverridden = overrides.front_end_dti != null;
  const backOverridden = overrides.back_end_dti != null;
  const front = frontOverridden ? Number(overrides.front_end_dti) : auto.front;
  const back = backOverridden ? Number(overrides.back_end_dti) : auto.back;

  const backTone = back == null ? 'var(--c-label2)' : back <= 43 ? 'var(--c-success)' : back <= 50 ? 'var(--c-warning)' : 'var(--c-danger)';

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/loans/${loanId}/underwriting`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'dti',
          total_monthly_income: Number(income) || 0,
          proposed_housing_payment: Number(housing) || 0,
          other_monthly_debts: Number(debts) || 0,
          overrides,
        }),
      });
      setStatus(res.ok ? { ok: true, msg: 'Saved.' } : { ok: false, msg: 'Save failed.' });
    } catch {
      setStatus({ ok: false, msg: 'Network error.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Inputs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Total monthly income" type="number" leftAddon={<span className="text-[13px]">$</span>} value={income} onChange={(e) => setIncome(e.target.value)} />
          <Input label="Proposed housing (PITIA)" type="number" leftAddon={<span className="text-[13px]">$</span>} value={housing} onChange={(e) => setHousing(e.target.value)} />
          <Input label="Other monthly debts" type="number" leftAddon={<span className="text-[13px]">$</span>} value={debts} onChange={(e) => setDebts(e.target.value)} />
        </div>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Ratios</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SmartField
            label="Front-end DTI"
            value={front ?? ''}
            format="percent"
            isAutoCalculated={!frontOverridden}
            formula="housing payment ÷ monthly income"
            onOverride={(v) => setOverrides((o) => ({ ...o, front_end_dti: v }))}
            onClearOverride={() => setOverrides((o) => { const n = { ...o }; delete n.front_end_dti; return n; })}
          />
          <SmartField
            label="Back-end DTI"
            value={back ?? ''}
            format="percent"
            isAutoCalculated={!backOverridden}
            formula="(housing + debts) ÷ monthly income"
            onOverride={(v) => setOverrides((o) => ({ ...o, back_end_dti: v }))}
            onClearOverride={() => setOverrides((o) => { const n = { ...o }; delete n.back_end_dti; return n; })}
          />
        </div>
        {back != null && (
          <p className="text-[12px]" style={{ color: backTone }}>
            {back <= 43 ? '✓ Within the 43% QM back-end threshold.' : back <= 50 ? '⚠ Above 43% — may require compensating factors or a non-QM path.' : '✗ Above 50% — exceeds most program limits.'}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 justify-end">
        {status && (
          <span className={`inline-flex items-center gap-1.5 text-[13px] ${status.ok ? 'text-[var(--c-success)]' : 'text-[var(--c-danger)]'}`}>
            {status.ok ? <Check size={14} /> : <X size={14} />} {status.msg}
          </span>
        )}
        <Button onClick={save} loading={saving}>Save worksheet</Button>
      </div>
    </div>
  );
}
