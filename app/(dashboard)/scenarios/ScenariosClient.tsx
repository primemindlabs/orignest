'use client';

import { useMemo, useState } from 'react';
import { LayoutGrid, Download, Mail, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PROGRAMS, availablePrograms, computeResults, CONFORMING_LIMIT,
  type BorrowerProfile, type ProgramResult,
} from '@/lib/pricing/scenarios';

const PROPERTY_TYPES = ['Single Family', 'Condo', 'Multi-Family 2-4', 'Investment'];
const OCCUPANCY = ['Primary', 'Second Home', 'Investment'];

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function num(s: string): number {
  return Number(s.replace(/[^0-9.]/g, '')) || 0;
}

export default function ScenariosClient() {
  const [creditScore, setCreditScore] = useState('740');
  const [annualIncome, setAnnualIncome] = useState('');
  const [monthlyDebt, setMonthlyDebt] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]);
  const [occupancy, setOccupancy] = useState(OCCUPANCY[0]);

  const [selected, setSelected] = useState<string[]>(PROGRAMS.filter((p) => p.defaultOn).map((p) => p.key));
  const [results, setResults] = useState<ProgramResult[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  const profile: BorrowerProfile = useMemo(() => ({
    creditScore: num(creditScore),
    annualIncome: num(annualIncome),
    monthlyDebt: num(monthlyDebt),
    purchasePrice: num(purchasePrice),
    downPayment: num(downPayment),
    propertyType,
    occupancy,
  }), [creditScore, annualIncome, monthlyDebt, purchasePrice, downPayment, propertyType, occupancy]);

  const loanAmount = Math.max(profile.purchasePrice - profile.downPayment, 0);
  const ltv = profile.purchasePrice > 0 ? (loanAmount / profile.purchasePrice) * 100 : 0;
  const available = availablePrograms(profile);

  function toggle(key: string) {
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  function handleCompare() {
    const activeKeys = selected.filter((k) => available.some((a) => a.key === k));
    setResults(computeResults(profile, activeKeys));
  }

  async function handlePdf() {
    if (!results) return;
    setDownloading(true);
    try {
      const res = await fetch('/api/scenarios/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, results }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'program-comparison.pdf';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }
    } finally {
      setDownloading(false);
    }
  }

  function handleEmail() {
    if (!results) return;
    const lines = results.map((r) =>
      `${r.name}: ${r.rate}% | P&I ${fmt(r.monthlyPI)} | Est. Payment ${fmt(r.monthlyPayment)} | Cash to Close ${fmt(r.cashToClose)} | PMI: ${r.pmi ? 'Yes' : 'No'}`
    );
    const body = `Here is a comparison of mortgage program options:\n\nPurchase Price: ${fmt(profile.purchasePrice)}\nDown Payment: ${fmt(profile.downPayment)} (${ltv.toFixed(0)}% LTV)\n\n${lines.join('\n')}\n\nLet me know which option works best for you.`;
    window.location.href = `mailto:?subject=${encodeURIComponent('Your Mortgage Program Comparison')}&body=${encodeURIComponent(body)}`;
  }

  const TAG_COLORS: Record<string, string> = {
    'Lowest Payment': 'bg-green/10 text-green',
    'Lowest Rate': 'bg-blue/10 text-blue',
    'No PMI': 'bg-navy/10 text-navy',
    'Lowest Cash to Close': 'bg-orange/10 text-orange',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <LayoutGrid size={22} className="text-blue" />
        <h1 className="text-[24px] font-bold text-label tracking-tight">Scenario Comparison</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-5">
        {/* Left — borrower profile */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-label">Borrower Profile</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Credit Score">
              <input type="number" min={580} max={850} value={creditScore} onChange={(e) => setCreditScore(e.target.value)} className="input" />
            </Field>
            <Field label="Annual Income">
              <input type="text" inputMode="numeric" value={annualIncome ? fmt(num(annualIncome)) : ''} onChange={(e) => setAnnualIncome(e.target.value)} placeholder="$" className="input" />
            </Field>
          </div>
          <Field label="Monthly Debt Payments">
            <input type="text" inputMode="numeric" value={monthlyDebt ? fmt(num(monthlyDebt)) : ''} onChange={(e) => setMonthlyDebt(e.target.value)} placeholder="$" className="input" />
          </Field>
          <Field label="Purchase Price">
            <input type="text" inputMode="numeric" value={purchasePrice ? fmt(num(purchasePrice)) : ''} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="$" className="input" />
          </Field>
          <Field label={`Down Payment${ltv > 0 ? ` · ${ltv.toFixed(0)}% LTV` : ''}`}>
            <input type="text" inputMode="numeric" value={downPayment ? fmt(num(downPayment)) : ''} onChange={(e) => setDownPayment(e.target.value)} placeholder="$" className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property Type">
              <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className="input">
                {PROPERTY_TYPES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Occupancy">
              <select value={occupancy} onChange={(e) => setOccupancy(e.target.value)} className="input">
                {OCCUPANCY.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
          </div>

          {/* Program checkboxes */}
          <div>
            <p className="text-xs font-medium text-label-2 mb-2">Programs to compare</p>
            <div className="space-y-1.5">
              {available.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm text-label cursor-pointer">
                  <input type="checkbox" checked={selected.includes(p.key)} onChange={() => toggle(p.key)} className="accent-blue" />
                  {p.name}
                </label>
              ))}
            </div>
            {loanAmount > CONFORMING_LIMIT && (
              <p className="text-[11px] text-label-3 mt-2">Loan exceeds conforming limit ({fmt(CONFORMING_LIMIT)}) — Jumbo available.</p>
            )}
          </div>

          <button
            onClick={handleCompare}
            disabled={profile.purchasePrice <= 0 || selected.length === 0}
            className="w-full py-2.5 bg-blue text-white text-sm font-semibold rounded-xl hover:bg-blue/90 transition-colors disabled:opacity-40"
          >
            Compare Programs
          </button>
        </div>

        {/* Right — comparison */}
        <div className="space-y-3">
          {!results ? (
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-10 text-center text-label-3 text-sm">
              Enter a borrower profile and click <span className="font-semibold text-label-2">Compare Programs</span> to see side-by-side options.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {results.map((r) => (
                  <div key={r.key} className="bg-white rounded-2xl border border-black/[0.06] shadow-card p-4">
                    <p className="text-sm font-bold text-label">{r.name}</p>
                    <p className="text-[28px] font-bold text-[#1D4ED8] leading-tight mt-1">{r.rate}%</p>
                    <div className="mt-3 space-y-1.5 text-[13px]">
                      <Row label="Monthly P&I" value={fmt(r.monthlyPI)} />
                      <Row label="Est. Payment (PITI)" value={fmt(r.monthlyPayment)} bold />
                      <Row label="Cash to Close" value={fmt(r.cashToClose)} />
                      <Row label="Min Credit" value={String(r.minCredit)} />
                      <Row label="PMI" value={r.pmi ? 'Yes' : 'No'} />
                    </div>
                    {r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {r.tags.map((t) => (
                          <span key={t} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', TAG_COLORS[t] ?? 'bg-black/[0.06] text-label-2')}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-label-3">
                <ShieldCheck size={12} /> Estimates only — taxes ($250) + insurance ($100) + PMI assumed; closing costs ~2.5%.
              </div>

              <div className="flex gap-2">
                <button onClick={handlePdf} disabled={downloading} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue text-white text-sm font-semibold rounded-xl hover:bg-blue/90 transition-colors disabled:opacity-40">
                  <Download size={15} /> {downloading ? 'Generating…' : 'Generate Comparison PDF'}
                </button>
                <button onClick={handleEmail} className="flex items-center justify-center gap-2 px-4 py-2.5 border border-black/[0.10] bg-white text-label-2 text-sm font-medium rounded-xl hover:bg-bg transition-colors">
                  <Mail size={15} /> Email to Borrower
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          border: 1px solid rgba(60,60,67,0.12);
          background: #F2F2F7;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-label-2 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-label-2">{label}</span>
      <span className={bold ? 'font-bold text-label' : 'font-medium text-label'}>{value}</span>
    </div>
  );
}
