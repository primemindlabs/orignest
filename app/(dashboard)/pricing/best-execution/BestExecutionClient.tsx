'use client';

import { useMemo, useState } from 'react';
import { Scale, Sparkles, AlertTriangle, CheckCircle2, XCircle, ShieldCheck, Clock } from 'lucide-react';

// Mirrors lib/ppe/types.ts (kept local to avoid importing server-only modules).
interface Risky { negativeAmortization: boolean; prepaymentPenalty: boolean; interestOnly: boolean; balloon: boolean }
interface PricedProduct {
  id: string; sourceLabel: string; lenderName: string; productName: string; loanType: string;
  termYears: number; amortizationType: string; noteRate: number; basePrice: number; totalAdjustment: number;
  adjustedPrice: number; lockDays: number; monthlyPI: number; risky: Risky;
  appliedAdjustments: { name: string; amount: number }[]; asOf: string | null; stale: boolean;
}
interface Ineligible { lenderName: string; productName: string; sourceLabel: string; reasons: string[] }
interface SourceStatus { id: string; label: string; status: 'ok' | 'gated' | 'empty' | 'error'; note?: string; eligibleCount: number }
interface Result {
  priced: PricedProduct[]; ineligible: Ineligible[];
  antiSteering: { lowestRate: PricedProduct | null; lowestRateNoRiskyFeatures: PricedProduct | null; lowestTotalCost: PricedProduct | null };
  sources: SourceStatus[]; anyStale: boolean;
}

const LOAN_TYPES = [
  { v: 'conventional', l: 'Conventional' }, { v: 'fha', l: 'FHA' }, { v: 'va', l: 'VA' },
  { v: 'usda', l: 'USDA' }, { v: 'jumbo', l: 'Jumbo' }, { v: 'dscr', l: 'DSCR' },
  { v: 'non_qm_bank_stmt', l: 'Bank Statement' }, { v: 'non_qm_1099', l: '1099' },
];
const TERMS = [30, 20, 15, 10];
const PURPOSES = [{ v: 'purchase', l: 'Purchase' }, { v: 'rate_term_refinance', l: 'Rate/Term Refi' }, { v: 'cash_out_refinance', l: 'Cash-Out Refi' }];
const OCCUPANCIES = [{ v: 'primary', l: 'Primary' }, { v: 'second_home', l: 'Second Home' }, { v: 'investment', l: 'Investment' }];
const PROP_TYPES = [{ v: 'single_family', l: 'Single Family' }, { v: 'condo', l: 'Condo' }, { v: 'multi_family', l: 'Multi-Family' }, { v: 'townhouse', l: 'Townhouse' }];
const LOCKS = [15, 30, 45, 60];

const INPUT = 'w-full h-9 px-3 rounded-lg bg-[#F2F2F7] border border-black/[0.06] text-[13px] text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30';

const fmtPrice = (n: number) => (n >= 0 ? n.toFixed(3) : n.toFixed(3));
const fmtUSD = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const riskyList = (r: Risky) => [r.negativeAmortization && 'Neg-Am', r.prepaymentPenalty && 'Prepay', r.interestOnly && 'IO', r.balloon && 'Balloon'].filter(Boolean) as string[];

export function BestExecutionClient() {
  const [loanType, setLoanType] = useState('conventional');
  const [termYears, setTermYears] = useState(30);
  const [fico, setFico] = useState('740');
  const [loanAmount, setLoanAmount] = useState('400000');
  const [propertyValue, setPropertyValue] = useState('500000');
  const [loanPurpose, setLoanPurpose] = useState('purchase');
  const [occupancy, setOccupancy] = useState('primary');
  const [propertyType, setPropertyType] = useState('single_family');
  const [lockDays, setLockDays] = useState(30);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const ltv = useMemo(() => {
    const la = Number(loanAmount) || 0, pv = Number(propertyValue) || 0;
    return pv > 0 ? (la / pv) * 100 : 0;
  }, [loanAmount, propertyValue]);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/ppe/price', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanType, termYears, fico: Number(fico), loanAmount: Number(loanAmount), propertyValue: Number(propertyValue), ltv, loanPurpose, occupancy, propertyType, lockDays }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error ?? 'Pricing failed'); return; }
      setResult(d as Result);
    } catch { setErr('Pricing failed'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-[#C9A95C]" />
          <h1 className="text-xl font-semibold text-[#0F1D2E]">Best Execution</h1>
        </div>
        <p className="text-[13px] text-[#8A8A8E] mt-0.5">
          Live best-execution pricing across your rate sheets and any connected pricing engine, with the anti-steering safe-harbor options.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Inputs */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 space-y-3">
          <Field label="Loan type"><select value={loanType} onChange={(e) => setLoanType(e.target.value)} className={INPUT}>{LOAN_TYPES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Term (yrs)"><select value={termYears} onChange={(e) => setTermYears(Number(e.target.value))} className={INPUT}>{TERMS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label="Lock (days)"><select value={lockDays} onChange={(e) => setLockDays(Number(e.target.value))} className={INPUT}>{LOCKS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
          </div>
          <Field label="FICO"><input type="number" value={fico} onChange={(e) => setFico(e.target.value)} className={INPUT} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Loan amount"><input type="number" value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} className={INPUT} /></Field>
            <Field label="Property value"><input type="number" value={propertyValue} onChange={(e) => setPropertyValue(e.target.value)} className={INPUT} /></Field>
          </div>
          <p className="text-[11px] text-[#8A8A8E]">LTV <span className="font-semibold text-[#0F1D2E] tabular-nums">{ltv.toFixed(2)}%</span></p>
          <Field label="Purpose"><select value={loanPurpose} onChange={(e) => setLoanPurpose(e.target.value)} className={INPUT}>{PURPOSES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Occupancy"><select value={occupancy} onChange={(e) => setOccupancy(e.target.value)} className={INPUT}>{OCCUPANCIES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></Field>
            <Field label="Property"><select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={INPUT}>{PROP_TYPES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select></Field>
          </div>
          <button onClick={run} disabled={busy} className="w-full mt-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#C9A95C] text-white text-[13px] font-semibold hover:brightness-95 disabled:opacity-50">
            <Sparkles size={14} /> {busy ? 'Pricing…' : 'Run best execution'}
          </button>
          {err && <p className="text-[12px] text-[#FF3B30]">{err}</p>}
        </div>

        {/* Results */}
        <div className="space-y-4 min-w-0">
          {!result ? (
            <div className="border border-dashed border-black/[0.1] rounded-2xl py-16 text-center text-[13px] text-[#8A8A8E]">
              Enter a scenario and run best execution.
            </div>
          ) : (
            <>
              {/* Source status */}
              <div className="flex items-center gap-2 flex-wrap">
                {result.sources.map((s) => (
                  <span key={s.id} title={s.note} className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                    s.status === 'ok' ? 'bg-[#34C759]/10 text-[#1a7a34]' :
                    s.status === 'gated' ? 'bg-black/[0.05] text-[#8A8A8E]' :
                    s.status === 'empty' ? 'bg-[#FF9500]/10 text-[#9a5700]' : 'bg-[#FF3B30]/10 text-[#9a1f18]'}`}>
                    {s.label}: {s.status === 'ok' ? `${s.eligibleCount} eligible` : s.status}
                  </span>
                ))}
                {result.anyStale && (
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#FF9500]/10 text-[#9a5700] inline-flex items-center gap-1">
                    <Clock size={11} /> some pricing not from today
                  </span>
                )}
              </div>

              {/* Anti-steering safe harbor */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <ShieldCheck size={14} className="text-[#C9A95C]" />
                  <h2 className="text-[13px] font-semibold text-[#0F1D2E]">Anti-steering options <span className="font-normal text-[#8A8A8E]">(§1026.36(e)(3) safe harbor)</span></h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SafeHarborCard title="Lowest rate" p={result.antiSteering.lowestRate} />
                  <SafeHarborCard title="Lowest rate, no risky features" p={result.antiSteering.lowestRateNoRiskyFeatures} />
                  <SafeHarborCard title="Lowest total cost" p={result.antiSteering.lowestTotalCost} />
                </div>
              </div>

              {/* Best-execution table */}
              <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 border-b border-black/[0.06] flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-[#34C759]" />
                  <span className="text-[12px] font-semibold text-[#0F1D2E]">Eligible products — best execution ({result.priced.length})</span>
                </div>
                {result.priced.length === 0 ? (
                  <p className="px-4 py-6 text-[13px] text-[#8A8A8E] text-center">No eligible products for this scenario.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wide text-[#AEAEB2] border-b border-black/[0.06]">
                          <th className="text-left font-semibold px-4 py-2">Lender / Product</th>
                          <th className="text-right font-semibold px-3 py-2">Rate</th>
                          <th className="text-right font-semibold px-3 py-2">Price</th>
                          <th className="text-right font-semibold px-3 py-2">Adj</th>
                          <th className="text-right font-semibold px-3 py-2">Mo. P&amp;I</th>
                          <th className="text-left font-semibold px-3 py-2">Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.priced.map((p, i) => (
                          <tr key={p.id} className={`border-b border-black/[0.04] ${i === 0 ? 'bg-[#C9A95C]/[0.06]' : ''}`}>
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-[#0F1D2E] flex items-center gap-1.5">
                                {p.lenderName}
                                {i === 0 && <span className="text-[9px] font-bold uppercase bg-[#C9A95C] text-white px-1.5 py-0.5 rounded">Best</span>}
                              </div>
                              <div className="text-[11px] text-[#8A8A8E] flex items-center gap-1.5">
                                {p.productName}
                                {riskyList(p.risky).map((r) => <span key={r} className="text-[9px] text-[#9a5700] bg-[#FF9500]/10 px-1 rounded">{r}</span>)}
                                {p.stale && <Clock size={10} className="text-[#9a5700]" />}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[#0F1D2E]">{p.noteRate.toFixed(3)}%</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtPrice(p.adjustedPrice)}</td>
                            <td className={`px-3 py-2.5 text-right tabular-nums ${p.totalAdjustment < 0 ? 'text-[#FF3B30]' : 'text-[#1a7a34]'}`}>{p.totalAdjustment >= 0 ? '+' : ''}{fmtPrice(p.totalAdjustment)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtUSD(p.monthlyPI)}</td>
                            <td className="px-3 py-2.5 text-[11px] text-[#8A8A8E]">{p.sourceLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Ineligible */}
              {result.ineligible.length > 0 && (
                <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-black/[0.06] flex items-center gap-1.5">
                    <XCircle size={14} className="text-[#FF3B30]" />
                    <span className="text-[12px] font-semibold text-[#0F1D2E]">Not eligible ({result.ineligible.length})</span>
                  </div>
                  <div className="divide-y divide-black/[0.04]">
                    {result.ineligible.map((x, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-start justify-between gap-3 opacity-70">
                        <div className="text-[12px] text-[#0F1D2E]">{x.lenderName} <span className="text-[#8A8A8E]">· {x.productName}</span></div>
                        <div className="text-[11px] text-[#9a1f18] text-right">{x.reasons.join('; ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FF9500] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#9a5700]">
                  <strong>Indicative only — confirm with the lender at lock.</strong> Pricing is from ingested rate sheets / connected pricing engines and is not a commitment. Ranking is by borrower cost and is never tied to originator compensation.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function SafeHarborCard({ title, p }: { title: string; p: PricedProduct | null }) {
  return (
    <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm p-3">
      <p className="text-[10px] uppercase tracking-wide text-[#AEAEB2] font-semibold mb-1.5">{title}</p>
      {p ? (
        <>
          <p className="text-[18px] font-thin tabular-nums tracking-tight text-[#0F1D2E]">{p.noteRate.toFixed(3)}%</p>
          <p className="text-[11px] text-[#0F1D2E] font-medium truncate">{p.lenderName}</p>
          <p className="text-[10px] text-[#8A8A8E]">{p.productName} · {fmtPrice(p.adjustedPrice)} px</p>
        </>
      ) : (
        <p className="text-[12px] text-[#AEAEB2] py-2">No qualifying option</p>
      )}
    </div>
  );
}
