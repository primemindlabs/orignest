'use client';

/**
 * Phase 139 — DSCR analysis for business-purpose loans (DSCR/non-QM/commercial),
 * which qualify on the property's cash flow (rent ÷ PITIA), not borrower DTI.
 */
import { useState } from 'react';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num = (s: string) => Number(s.replace(/[^0-9.]/g, '')) || 0;

export function DscrWorksheet({ initial }: { initial: { monthlyRent: number; pitia: number } }) {
  const [rent, setRent] = useState(initial.monthlyRent ? String(initial.monthlyRent) : '');
  const [pitia, setPitia] = useState(initial.pitia ? String(initial.pitia) : '');

  const r = num(rent);
  const p = num(pitia);
  const dscr = p > 0 ? r / p : 0;
  const status = dscr >= 1.25 ? 'strong' : dscr >= 1.0 ? 'qualifying' : dscr > 0 ? 'below' : null;
  const statusColor = status === 'strong' ? 'text-green' : status === 'qualifying' ? 'text-gold-700' : 'text-red';
  const statusLabel = status === 'strong' ? 'Strong (≥ 1.25)' : status === 'qualifying' ? 'Qualifying (≥ 1.00)' : status === 'below' ? 'Below 1.00 — most DSCR lenders want ≥ 1.0 (some allow with reserves)' : '—';

  const field = 'w-full rounded-lg border border-[var(--c-border)] px-3 py-2.5 text-[14px] text-[var(--c-text)] bg-[var(--c-surface)] focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5">
        <p className="text-[13px] font-semibold text-[var(--c-text)] mb-3">Inputs</p>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[12px] text-[var(--c-label2)]">Monthly market rent</span>
            <input value={rent} onChange={(e) => setRent(e.target.value)} inputMode="numeric" placeholder="$" className={`${field} mt-1`} />
          </label>
          <label className="block">
            <span className="text-[12px] text-[var(--c-label2)]">PITIA (proposed housing payment)</span>
            <input value={pitia} onChange={(e) => setPitia(e.target.value)} inputMode="numeric" placeholder="$" className={`${field} mt-1`} />
          </label>
        </div>
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5">
        <p className="text-[13px] font-semibold text-[var(--c-text)] mb-3">DSCR</p>
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-[34px] font-bold tabular-nums ${statusColor}`}>{dscr ? dscr.toFixed(2) : '—'}</p>
            <p className={`text-[12px] mt-0.5 ${statusColor}`}>{statusLabel}</p>
          </div>
          <div className="text-right text-[12px] text-[var(--c-label2)]">
            <p>Rent {usd(r)}/mo</p>
            <p>PITIA {usd(p)}/mo</p>
          </div>
        </div>
        <p className="text-[11px] text-[var(--c-label3)] mt-3">DSCR = monthly rent ÷ PITIA. Business-purpose loan — borrower DTI is not used to qualify.</p>
      </div>
    </div>
  );
}
