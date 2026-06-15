'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';

const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function Stat({ label, value, tone = 'var(--c-text)', sub }: { label: string; value: string; tone?: string; sub?: string }) {
  return (
    <div className="bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[12px] p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--c-label3)]">{label}</div>
      <div className="mt-1 text-[24px] font-bold tabular-nums" style={{ color: tone }}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-[var(--c-label2)]">{sub}</div>}
    </div>
  );
}

export function BreakEvenCalculator({ suggestedPayment, loanAmount }: { suggestedPayment: number; loanAmount: number }) {
  const [costs, setCosts] = useState('');
  const [current, setCurrent] = useState('');
  const [proposed, setProposed] = useState(suggestedPayment > 0 ? String(suggestedPayment) : '');

  const closingCosts = Number(costs) || 0;
  const currentPmt = Number(current) || 0;
  const proposedPmt = Number(proposed) || 0;

  const monthlySavings = currentPmt - proposedPmt;
  const hasInputs = closingCosts > 0 && currentPmt > 0 && proposedPmt > 0;
  const positiveSavings = monthlySavings > 0;
  const breakEvenMonths = positiveSavings ? closingCosts / monthlySavings : null;
  const breakEvenYears = breakEvenMonths != null ? breakEvenMonths / 12 : null;

  const savingsTone = !hasInputs
    ? 'var(--c-label2)'
    : positiveSavings
      ? 'var(--c-success)'
      : 'var(--c-danger)';

  return (
    <div className="space-y-5">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Inputs</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Estimated closing costs"
            type="number"
            inputMode="decimal"
            placeholder="0"
            leftAddon={<span className="text-[13px]">$</span>}
            value={costs}
            onChange={(e) => setCosts(e.target.value)}
          />
          <Input
            label="Current payment"
            type="number"
            inputMode="decimal"
            placeholder="0"
            leftAddon={<span className="text-[13px]">$</span>}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Input
            label="Proposed payment"
            type="number"
            inputMode="decimal"
            placeholder="0"
            leftAddon={<span className="text-[13px]">$</span>}
            value={proposed}
            onChange={(e) => setProposed(e.target.value)}
            hint={suggestedPayment > 0 ? 'Prefilled est. (6.5% / 30yr P&I)' : undefined}
          />
        </div>
        {loanAmount > 0 && (
          <p className="text-[12px] text-[var(--c-label3)]">
            Loan amount on file: {fmtMoney(loanAmount)}. Adjust the proposed payment to match your actual quote.
          </p>
        )}
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Results</h3>
        {!hasInputs ? (
          <p className="text-[13px] text-[var(--c-label2)]">
            Enter closing costs and both payments above to see monthly savings and the break-even point.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Stat
                label="Monthly savings"
                value={`${monthlySavings < 0 ? '−' : ''}${fmtMoney(Math.abs(monthlySavings))}/mo`}
                tone={savingsTone}
                sub={positiveSavings ? 'Lower than current payment' : 'Proposed is not lower'}
              />
              <Stat
                label="Break-even"
                value={
                  breakEvenMonths == null
                    ? '—'
                    : `${Math.ceil(breakEvenMonths)} mo`
                }
                tone={breakEvenMonths == null ? 'var(--c-label2)' : 'var(--c-gold-deep)'}
                sub={
                  breakEvenYears == null
                    ? 'No savings to recoup costs'
                    : `≈ ${breakEvenYears.toFixed(1)} years to recover ${fmtMoney(closingCosts)}`
                }
              />
            </div>
            {positiveSavings && breakEvenMonths != null && (
              <p className="text-[12px] text-[var(--c-label2)]">
                After month {Math.ceil(breakEvenMonths)}, the borrower nets {fmtMoney(monthlySavings)}/mo in ongoing
                savings. Over 5 years that is {fmtMoney(monthlySavings * 60 - closingCosts)} net of closing costs.
              </p>
            )}
            {!positiveSavings && (
              <p className="text-[12px] text-[var(--c-danger)]">
                The proposed payment is not lower than the current payment, so closing costs will not be recouped through
                monthly savings.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
