'use client';

// Phase 115 — per-loan Scenario Builder. Up to 4 side-by-side scenarios, live local
// metrics, persisted on blur. Recommended + send-to-portal toggles. "Compare" opens a
// print-friendly comparison (browser print-to-PDF — no PDF renderer dependency).
import { useEffect, useState, useCallback } from 'react';
import { IconPlus, IconTrash, IconStar, IconStarFilled, IconEye, IconPrinter } from '@tabler/icons-react';
import { computeScenarioMetrics, isArm } from '@/lib/scenarios/compute';

const LOAN_TYPES = ['conventional', 'fha', 'va', 'dscr', 'jumbo', 'arm_5_1', 'arm_7_1'];
const usd = (n: number | null | undefined) => (n == null ? '—' : `$${Math.round(Number(n)).toLocaleString()}`);

interface Scenario {
  id: string;
  scenario_name: string;
  loan_type: string;
  purchase_price: number;
  down_payment_pct: number;
  loan_amount: number;
  interest_rate: number;
  loan_term_months: number;
  monthly_payment: number | null;
  is_recommended: boolean;
  is_visible_to_borrower: boolean;
}

export function ScenarioBuilder({ loanId }: { loanId: string }) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/loans/${loanId}/scenarios`);
    const d = await res.json();
    setScenarios(d.scenarios ?? []);
    setLoading(false);
  }, [loanId]);
  useEffect(() => {
    load();
  }, [load]);

  async function addScenario() {
    if (scenarios.length >= 4) return;
    setBusy(true);
    await fetch(`/api/loans/${loanId}/scenarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loan_type: 'conventional', purchase_price: 500000, down_payment_pct: 20, interest_rate: 6.875, loan_term_months: 360 }),
    });
    await load();
    setBusy(false);
  }

  function patchLocal(id: string, patch: Partial<Scenario>) {
    setScenarios((cur) =>
      cur.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch };
        const m = computeScenarioMetrics({
          purchase_price: Number(next.purchase_price),
          down_payment_pct: Number(next.down_payment_pct),
          interest_rate: Number(next.interest_rate),
          loan_term_months: Number(next.loan_term_months),
        });
        return { ...next, loan_amount: m.loan_amount, monthly_payment: m.monthly_payment };
      })
    );
  }

  async function persist(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/loans/${loanId}/scenarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/loans/${loanId}/scenarios/${id}`, { method: 'DELETE' });
    load();
  }

  async function compare() {
    if (scenarios.length < 2) return;
    const res = await fetch(`/api/loans/${loanId}/scenarios/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioIds: scenarios.map((s) => s.id) }),
    });
    const d = await res.json();
    if (d.printUrl) window.open(d.printUrl, '_blank');
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={addScenario}
          disabled={busy || scenarios.length >= 4}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#C9A95C] px-3 py-2 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50"
        >
          <IconPlus size={15} /> Add scenario {scenarios.length >= 4 ? '(max 4)' : ''}
        </button>
        {scenarios.length >= 2 && (
          <button onClick={compare} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <IconPrinter size={15} /> Compare (PDF)
          </button>
        )}
      </div>

      {scenarios.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center text-sm text-gray-400">
          No scenarios yet. Add one to start comparing.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className={`rounded-2xl border bg-white p-4 space-y-3 ${s.is_recommended ? 'border-[#C9A95C] ring-1 ring-[#C9A95C]/30' : 'border-gray-100'}`}
            >
              <div className="flex items-center justify-between">
                <input
                  value={s.scenario_name}
                  onChange={(e) => patchLocal(s.id, { scenario_name: e.target.value })}
                  onBlur={(e) => persist(s.id, { scenario_name: e.target.value })}
                  className="text-sm font-semibold text-gray-900 bg-transparent focus:outline-none w-full"
                />
                <button onClick={() => remove(s.id)} aria-label="Remove" className="text-gray-300 hover:text-red-400 shrink-0">
                  <IconTrash size={14} />
                </button>
              </div>

              <label className="block">
                <span className="text-[11px] text-gray-400">Loan type</span>
                <select
                  value={s.loan_type}
                  onChange={(e) => { patchLocal(s.id, { loan_type: e.target.value }); persist(s.id, { loan_type: e.target.value }); }}
                  className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white focus:outline-none"
                >
                  {LOAN_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>

              {([
                ['Purchase price', 'purchase_price'],
                ['Down payment %', 'down_payment_pct'],
                ['Rate %', 'interest_rate'],
                ['Term (mo)', 'loan_term_months'],
              ] as [string, keyof Scenario][]).map(([label, key]) => (
                <label key={key} className="block">
                  <span className="text-[11px] text-gray-400">{label}</span>
                  <input
                    value={String(s[key] ?? '')}
                    inputMode="decimal"
                    onChange={(e) => patchLocal(s.id, { [key]: e.target.value } as any)}
                    onBlur={(e) => persist(s.id, { [key]: Number(e.target.value) || 0 })}
                    className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30"
                  />
                </label>
              ))}

              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-[10px] text-gray-400">Monthly P&amp;I</p>
                <p className="text-xl font-bold text-gray-900">{usd(s.monthly_payment)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Loan {usd(s.loan_amount)}</p>
              </div>

              {isArm(s.loan_type) && (
                <p className="text-[10px] text-amber-600 leading-snug">
                  Rate shown is the initial-period rate. Payment may increase after the fixed period.
                </p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => persist(s.id, { is_recommended: !s.is_recommended })}
                  className={`inline-flex items-center gap-1 text-[11px] ${s.is_recommended ? 'text-[#C9A95C]' : 'text-gray-400'}`}
                >
                  {s.is_recommended ? <IconStarFilled size={12} /> : <IconStar size={12} />} Recommended
                </button>
                <button
                  onClick={() => persist(s.id, { is_visible_to_borrower: !s.is_visible_to_borrower })}
                  className={`inline-flex items-center gap-1 text-[11px] ${s.is_visible_to_borrower ? 'text-green-600' : 'text-gray-400'}`}
                >
                  <IconEye size={12} /> {s.is_visible_to_borrower ? 'In portal' : 'Share'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
