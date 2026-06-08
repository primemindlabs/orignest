'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Briefcase, Home, Landmark, Percent, ArrowRight } from 'lucide-react';
import {
  selfEmployedMonthly, rentalMonthly, grossUp, dti,
  type SelfEmployedYear,
} from '@/lib/income/calc';

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const num = (v: string) => Number(v) || 0;

function Field({ label, value, onChange, prefix }: { label: string; value: string; onChange: (v: string) => void; prefix?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-label-2 mb-1">{label}</span>
      <div className="relative">
        {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-label-3 text-[13px]">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full text-[13px] rounded-lg border border-border py-2 bg-surface text-label focus:outline-none font-mono ${prefix ? 'pl-6 pr-3' : 'px-3'}`}
        />
      </div>
    </label>
  );
}

function Result({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-border first:border-t-0">
      <span className="text-[13px] text-label-2">{label}</span>
      <span className={`font-mono text-[15px] font-semibold ${accent ? 'text-gold-700' : 'text-label'}`}>{value}</span>
    </div>
  );
}

function Card({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5 card-shadow">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-[10px] bg-gold-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-gold-600" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-label">{title}</h2>
          <p className="text-[12px] text-label-3">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function IncomeClient() {
  // Self-employed (Fannie 1084 / Freddie 91), 2 years.
  const emptyYear: SelfEmployedYear = { netProfit: 0, depreciation: 0, depletion: 0, amortizationCasualty: 0, businessUseOfHome: 0, mealsExclusion: 0, nonrecurringIncome: 0 };
  const [y1, setY1] = useState<Record<string, string>>({ netProfit: '', depreciation: '', businessUseOfHome: '' });
  const [y2, setY2] = useState<Record<string, string>>({ netProfit: '', depreciation: '', businessUseOfHome: '' });
  const toYear = (s: Record<string, string>): SelfEmployedYear => ({ ...emptyYear, netProfit: num(s.netProfit), depreciation: num(s.depreciation), businessUseOfHome: num(s.businessUseOfHome) });
  const se = selfEmployedMonthly([toYear(y1), toYear(y2)]);

  // Rental (Schedule E 75%).
  const [rent, setRent] = useState({ gross: '', pitia: '' });
  const r = rentalMonthly(num(rent.gross), num(rent.pitia));

  // Non-taxable gross-up.
  const [ss, setSs] = useState({ amount: '', pct: '25' });
  const grossed = grossUp(num(ss.amount), num(ss.pct));

  // DTI rollup.
  const [dtiIn, setDtiIn] = useState({ income: '', housing: '', debts: '' });
  const d = dti({ monthlyIncome: num(dtiIn.income), proposedHousingPayment: num(dtiIn.housing), otherMonthlyDebts: num(dtiIn.debts) });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-label tracking-tight">Income Calculators</h1>
          <p className="text-[13px] text-label-2 mt-0.5">Agency-method qualifying income worksheets</p>
        </div>
        <Link href="/dscr" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gold-700 hover:text-gold-600">
          DSCR analyzer <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <Card icon={Briefcase} title="Self-Employed (Fannie 1084 / Freddie 91)" subtitle="2-year average with Schedule C add-backs">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide">Year 1 (prior)</p>
            <Field label="Net profit (Sch C ln 31)" prefix="$" value={y1.netProfit} onChange={(v) => setY1({ ...y1, netProfit: v })} />
            <Field label="Depreciation" prefix="$" value={y1.depreciation} onChange={(v) => setY1({ ...y1, depreciation: v })} />
            <Field label="Business use of home" prefix="$" value={y1.businessUseOfHome} onChange={(v) => setY1({ ...y1, businessUseOfHome: v })} />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-label-3 uppercase tracking-wide">Year 2 (recent)</p>
            <Field label="Net profit (Sch C ln 31)" prefix="$" value={y2.netProfit} onChange={(v) => setY2({ ...y2, netProfit: v })} />
            <Field label="Depreciation" prefix="$" value={y2.depreciation} onChange={(v) => setY2({ ...y2, depreciation: v })} />
            <Field label="Business use of home" prefix="$" value={y2.businessUseOfHome} onChange={(v) => setY2({ ...y2, businessUseOfHome: v })} />
          </div>
        </div>
        <div className="mt-4">
          <Result label="Adjusted Yr1 / Yr2" value={`${usd(se.adjustedByYear[0] ?? 0)} / ${usd(se.adjustedByYear[1] ?? 0)}`} />
          <Result label="Qualifying monthly income" value={usd(se.monthlyIncome)} accent />
          {se.declining && <p className="text-[11px] text-danger mt-1.5">⚠ Income declined year-over-year — underwriter review recommended.</p>}
        </div>
      </Card>

      <Card icon={Home} title="Rental Income (Schedule E, 75%)" subtitle="75% of gross rent less full PITIA">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Gross monthly rent" prefix="$" value={rent.gross} onChange={(v) => setRent({ ...rent, gross: v })} />
          <Field label="Monthly PITIA" prefix="$" value={rent.pitia} onChange={(v) => setRent({ ...rent, pitia: v })} />
        </div>
        <div className="mt-4">
          <Result label="Effective rent (75%)" value={usd(r.effectiveRent)} />
          <Result label={r.isLiability ? 'Net monthly (liability)' : 'Net monthly income'} value={usd(r.netMonthly)} accent={!r.isLiability} />
        </div>
      </Card>

      <Card icon={Landmark} title="Non-Taxable Gross-Up" subtitle="Social Security & other tax-free income">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Monthly non-taxable income" prefix="$" value={ss.amount} onChange={(v) => setSs({ ...ss, amount: v })} />
          <Field label="Gross-up %" value={ss.pct} onChange={(v) => setSs({ ...ss, pct: v })} />
        </div>
        <div className="mt-4">
          <Result label="Grossed-up qualifying income" value={usd(grossed)} accent />
        </div>
      </Card>

      <Card icon={Percent} title="DTI Ratios" subtitle="Front-end (housing) and back-end (total debt)">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Monthly income" prefix="$" value={dtiIn.income} onChange={(v) => setDtiIn({ ...dtiIn, income: v })} />
          <Field label="Proposed housing" prefix="$" value={dtiIn.housing} onChange={(v) => setDtiIn({ ...dtiIn, housing: v })} />
          <Field label="Other debts" prefix="$" value={dtiIn.debts} onChange={(v) => setDtiIn({ ...dtiIn, debts: v })} />
        </div>
        <div className="mt-4">
          <Result label="Front-end DTI" value={`${d.frontEnd}%`} />
          <Result label="Back-end DTI" value={`${d.backEnd}%`} accent={d.backEnd > 0 && d.backEnd <= 43} />
          {d.backEnd > 43 && <p className="text-[11px] text-danger mt-1.5">Back-end DTI exceeds 43% — may require compensating factors / non-QM.</p>}
        </div>
      </Card>
    </div>
  );
}
