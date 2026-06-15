'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';

interface AccountInput {
  key: string;
  label: string;
  value: number;
  /** Portion of the balance counted toward reserves (e.g. retirement at 70%). */
  reserveFactor: number;
}

interface Props {
  accounts: AccountInput[];
  downPayment: number;
  defaultMonthlyHousing: number;
  loanAmount: number;
  applicationOnFile: boolean;
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function reservesTone(months: number | null): string {
  if (months == null) return 'var(--c-label2)';
  if (months >= 6) return 'var(--c-success)';
  if (months >= 2) return 'var(--c-gold-deep)';
  return 'var(--c-danger)';
}

function reservesNote(months: number | null): string {
  if (months == null) return 'Enter a proposed housing payment to measure reserves.';
  if (months >= 6) return 'Strong — clears 6+ months on most conventional and jumbo programs.';
  if (months >= 2) return 'Adequate for agency programs (typically 2–6 months required).';
  return 'Thin — below the 2-month floor many programs expect. Document additional sourced funds.';
}

export function ReservesWorksheet({
  accounts,
  downPayment,
  defaultMonthlyHousing,
  loanAmount,
  applicationOnFile,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    () => Object.fromEntries(accounts.map((a) => [a.key, a.value ? String(a.value) : ''])),
  );
  const [housing, setHousing] = useState<string>(defaultMonthlyHousing ? String(defaultMonthlyHousing) : '');
  const [funds, setFunds] = useState<string>(downPayment ? String(downPayment) : '');

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const { totalAssets, eligibleReserves, postCloseLiquid, months } = useMemo(() => {
    const total = accounts.reduce((sum, a) => sum + num(values[a.key] ?? ''), 0);
    const eligible = accounts.reduce((sum, a) => sum + num(values[a.key] ?? '') * a.reserveFactor, 0);
    const fundsToClose = num(funds);
    const postClose = Math.max(0, eligible - fundsToClose);
    const monthly = num(housing);
    const mo = monthly > 0 ? Math.round((postClose / monthly) * 10) / 10 : null;
    return { totalAssets: total, eligibleReserves: eligible, postCloseLiquid: postClose, months: mo };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, housing, funds, accounts]);

  const tone = reservesTone(months);

  return (
    <div className="space-y-5">
      {/* Headline reserves card */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 flex items-center gap-5">
        <div className="text-center min-w-[88px]">
          <p className="text-[34px] font-bold tabular-nums leading-none" style={{ color: tone }}>
            {months != null ? months : '—'}
          </p>
          <p className="text-[11px] text-[var(--c-label3)] mt-1 uppercase tracking-wide">Months reserves</p>
        </div>
        <div className="border-l border-[var(--c-border)] pl-5">
          <p className="text-[15px] font-semibold" style={{ color: tone }}>
            {fmt(postCloseLiquid)} post-close
          </p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 leading-relaxed max-w-md">
            {reservesNote(months)}
          </p>
        </div>
      </div>

      {/* Asset accounts */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Liquid assets</h3>
          {applicationOnFile && (
            <span className="text-[11px] text-[var(--c-label3)]">from 1003 application</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {accounts.map((a) => (
            <Input
              key={a.key}
              label={a.reserveFactor < 1 ? `${a.label} · ${Math.round(a.reserveFactor * 100)}% counted` : a.label}
              type="number"
              leftAddon={<span className="text-[13px]">$</span>}
              value={values[a.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [a.key]: e.target.value }))}
            />
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[var(--c-border)]">
          <span className="text-[12px] text-[var(--c-label2)]">Total stated assets</span>
          <span className="text-[13px] font-semibold tabular-nums text-[var(--c-text)]">{fmt(totalAssets)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--c-label2)]">Reserve-eligible (after factors)</span>
          <span className="text-[13px] font-semibold tabular-nums text-[var(--c-text)]">{fmt(eligibleReserves)}</span>
        </div>
      </div>

      {/* Outflows and housing */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-4">
        <h3 className="text-[13px] font-semibold text-[var(--c-text)]">Funds to close &amp; housing</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Funds to close (down payment + costs)"
            type="number"
            leftAddon={<span className="text-[13px]">$</span>}
            value={funds}
            onChange={(e) => setFunds(e.target.value)}
            hint={downPayment > 0 ? `Down payment on file: ${fmt(downPayment)}` : undefined}
          />
          <Input
            label="Proposed monthly housing (PITIA)"
            type="number"
            leftAddon={<span className="text-[13px]">$</span>}
            value={housing}
            onChange={(e) => setHousing(e.target.value)}
            hint={
              loanAmount > 0
                ? `Estimated from ${fmt(loanAmount)} loan @ ~7% + T&I`
                : 'Set the proposed payment to measure reserves'
            }
          />
        </div>
        <p className="text-[12px] text-[var(--c-label3)] leading-relaxed">
          Months of reserves = (reserve-eligible assets − funds to close) ÷ proposed monthly housing payment.
          Retirement accounts are discounted to 70% to reflect typical vesting/liquidation haircuts. Figures
          here are for analysis only and are not saved.
        </p>
      </div>
    </div>
  );
}
