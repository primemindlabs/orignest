'use client';

/** Phase 43.3 — interactive DSCR calculator. Live NOI / DSCR / cashflow + color
 * badge at the 1.0 / 1.25 thresholds + Scenario AI nudge below 1.0. */
import { useState, useMemo } from 'react';
import { calculateDscr, type DscrInputs } from '@/lib/loans/calculators';
import { ScenarioAIPrompt } from '@/components/loanFile/ScenarioAIPrompt';

const FIELDS: { key: keyof DscrInputs; label: string; suffix?: string; step?: number }[] = [
  { key: 'gross_monthly_rent', label: 'Gross monthly rent', suffix: '$' },
  { key: 'vacancy_rate', label: 'Vacancy rate', suffix: '%' },
  { key: 'taxes_monthly', label: 'Property taxes / mo', suffix: '$' },
  { key: 'insurance_monthly', label: 'Insurance / mo', suffix: '$' },
  { key: 'hoa_monthly', label: 'HOA / mo', suffix: '$' },
  { key: 'maintenance_monthly', label: 'Maintenance / mo', suffix: '$' },
  { key: 'management_fee_pct', label: 'Management fee', suffix: '%' },
  { key: 'proposed_loan_amount', label: 'Loan amount', suffix: '$' },
  { key: 'proposed_rate', label: 'Interest rate', suffix: '%', step: 0.125 },
  { key: 'amortization_years', label: 'Amortization (years)' },
];

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export function DscrCalculatorClient() {
  const [v, setV] = useState<DscrInputs>({
    gross_monthly_rent: 3200, vacancy_rate: 5, insurance_monthly: 150, taxes_monthly: 350, hoa_monthly: 0,
    management_fee_pct: 8, maintenance_monthly: 100, proposed_loan_amount: 360000, proposed_rate: 7.25,
    amortization_years: 30, is_interest_only: false,
  });
  const r = useMemo(() => calculateDscr(v), [v]);
  const set = (k: keyof DscrInputs, val: number) => setV((s) => ({ ...s, [k]: val }));

  const badge = r.dscr_status === 'strong' ? { c: '#27AE60', t: `Strong DSCR ${r.dscr.toFixed(2)}` }
    : r.dscr_status === 'qualifying' ? { c: '#F39C12', t: `Qualifying DSCR ${r.dscr.toFixed(2)}` }
    : { c: 'var(--c-danger)', t: `Below 1.0 — DSCR ${r.dscr.toFixed(2)}` };

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {/* Inputs */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)]">Property & loan</p>
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-[var(--c-text)]">{f.label}</span>
            <span className="inline-flex items-center gap-1">
              {f.suffix === '$' && <span className="text-[12px] text-[var(--c-label2)]">$</span>}
              <input type="number" step={f.step ?? 1} value={Number.isFinite(v[f.key] as number) ? (v[f.key] as number) : 0}
                onChange={(e) => set(f.key, parseFloat(e.target.value) || 0)}
                className="w-28 text-right text-[13px] font-mono rounded-[8px] border border-[var(--c-border)] bg-[var(--c-bg)] px-2 py-1 text-[var(--c-text)] focus:outline-none focus:border-[var(--c-gold)]" />
              {f.suffix === '%' && <span className="text-[12px] text-[var(--c-label2)]">%</span>}
            </span>
          </label>
        ))}
        <label className="flex items-center gap-2 pt-1">
          <input type="checkbox" checked={v.is_interest_only} onChange={(e) => setV((s) => ({ ...s, is_interest_only: e.target.checked }))} />
          <span className="text-[13px] text-[var(--c-text)]">Interest-only payment</span>
        </label>
      </div>

      {/* Results */}
      <div className="space-y-3">
        <div className="rounded-[14px] p-4 text-white" style={{ background: badge.c }}>
          <p className="text-[11px] uppercase tracking-wide opacity-90">Debt Service Coverage Ratio</p>
          <p className="text-[34px] font-bold font-mono leading-none mt-1">{r.dscr.toFixed(2)}</p>
          <p className="text-[12px] mt-1 opacity-95">{badge.t}</p>
        </div>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 space-y-2 text-[13px]">
          {[['Effective gross income', `$${fmt(r.effective_gross_income)}/yr`], ['Total expenses', `$${fmt(r.total_annual_expenses)}/yr`], ['Net operating income', `$${fmt(r.noi)}/yr`], ['Annual debt service', `$${fmt(r.annual_debt_service)}/yr`], ['Monthly cash flow', `$${fmt(r.monthly_cashflow)}/mo`]].map(([l, val]) => (
            <div key={l} className="flex items-center justify-between"><span className="text-[var(--c-label2)]">{l}</span><span className="font-mono text-[var(--c-text)]">{val}</span></div>
          ))}
        </div>
        {r.dscr_status === 'below' && <ScenarioAIPrompt trigger="dscr_below_1" />}
      </div>
    </div>
  );
}
