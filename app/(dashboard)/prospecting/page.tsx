'use client';

import { useState } from 'react';
import { Calculator, TrendingUp, UserPlus, Upload, Bell, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoanPurpose = 'purchase' | 'refinance' | 'cash_out_refi';
type LoanType = 'conventional' | 'fha' | 'va' | 'usda' | 'jumbo';
type CreditRange = '580-619' | '620-659' | '660-699' | '700-719' | '720-739' | '740-759' | '760+';

interface PrequalResult {
  maxLoanAmount: number;
  estimatedRateMin: number;
  estimatedRateMax: number;
  estimatedPayment: number;
  recommendedProgram: LoanType;
  programNote: string;
}

function getRecommendedProgram(creditRange: CreditRange, loanPurpose: LoanPurpose): { program: LoanType; note: string } {
  const creditMid: Record<CreditRange, number> = {
    '580-619': 599, '620-659': 639, '660-699': 679,
    '700-719': 709, '720-739': 729, '740-759': 749, '760+': 775,
  };
  const credit = creditMid[creditRange];

  if (credit < 620) return { program: 'fha', note: 'FHA allows credit scores as low as 580 with 3.5% down.' };
  if (credit >= 720) return { program: 'conventional', note: 'Excellent credit qualifies for best conventional rates.' };
  if (loanPurpose === 'purchase' && credit >= 620) return { program: 'fha', note: 'FHA is a strong option for first-time buyers with moderate credit.' };
  return { program: 'conventional', note: 'Conventional financing is available at your credit tier.' };
}

function calculatePrequal(
  annualIncome: number,
  downPayment: number,
  creditRange: CreditRange,
  loanPurpose: LoanPurpose,
): PrequalResult {
  // Standard 28% front-end DTI
  const monthlyIncome = annualIncome / 12;
  const maxMonthlyPayment = monthlyIncome * 0.28;

  // Rate based on credit
  const rateMap: Record<CreditRange, [number, number]> = {
    '580-619': [7.5, 8.25],
    '620-659': [7.125, 7.625],
    '660-699': [6.875, 7.375],
    '700-719': [6.75, 7.0],
    '720-739': [6.625, 6.875],
    '740-759': [6.5, 6.75],
    '760+': [6.375, 6.625],
  };
  const [rateMin, rateMax] = rateMap[creditRange];
  const midRate = (rateMin + rateMax) / 2;

  // Calculate max loan from payment
  const monthlyRate = midRate / 100 / 12;
  const maxLoan = maxMonthlyPayment / (monthlyRate * Math.pow(1 + monthlyRate, 360)) * (Math.pow(1 + monthlyRate, 360) - 1);
  const maxWithDown = maxLoan + downPayment;

  const { program, note } = getRecommendedProgram(creditRange, loanPurpose);
  const estimatedPayment = (maxLoan * monthlyRate * Math.pow(1 + monthlyRate, 360)) / (Math.pow(1 + monthlyRate, 360) - 1);

  return {
    maxLoanAmount: Math.round(maxLoan / 1000) * 1000,
    estimatedRateMin: rateMin,
    estimatedRateMax: rateMax,
    estimatedPayment: Math.round(estimatedPayment),
    recommendedProgram: program,
    programNote: note,
  };
}

const MARKET_RATES = [
  { term: '30-yr Fixed', rate: '6.875%', change: '+0.0125', trend: 'up' },
  { term: '15-yr Fixed', rate: '6.125%', change: '-0.0125', trend: 'down' },
  { term: '5/1 ARM', rate: '6.250%', change: '+0.025', trend: 'up' },
  { term: 'FHA 30-yr', rate: '6.625%', change: '0.000', trend: 'flat' },
  { term: 'VA 30-yr', rate: '6.250%', change: '-0.0125', trend: 'down' },
  { term: 'Jumbo 30-yr', rate: '7.000%', change: '+0.025', trend: 'up' },
];

export default function ProspectingPage() {
  const [tab, setTab] = useState<'calculator' | 'rates'>('calculator');
  const [loanPurpose, setLoanPurpose] = useState<LoanPurpose>('purchase');
  const [annualIncome, setAnnualIncome] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [creditRange, setCreditRange] = useState<CreditRange>('720-739');
  const [result, setResult] = useState<PrequalResult | null>(null);

  function calculate() {
    const income = parseFloat(annualIncome.replace(/,/g, ''));
    const down = parseFloat(downPayment.replace(/,/g, ''));
    if (!income || income <= 0) return;
    setResult(calculatePrequal(income, down || 0, creditRange, loanPurpose));
  }

  const PROGRAM_LABELS: Record<LoanType, string> = {
    conventional: 'Conventional',
    fha: 'FHA',
    va: 'VA',
    usda: 'USDA',
    jumbo: 'Jumbo',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-label tracking-tight">Prospecting</h1>
        <p className="text-sm text-label-2 mt-0.5">Pre-qual calculator and market intelligence tools</p>
      </div>

      <div className="flex gap-1 bg-black/[0.06] rounded-[10px] p-1 w-fit">
        {[
          { id: 'calculator', label: 'Pre-Qual Calculator', icon: Calculator },
          { id: 'rates', label: 'Market Rates', icon: TrendingUp },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-[8px] text-sm font-medium transition-colors',
              tab === id ? 'bg-white text-label shadow-card' : 'text-label-3 hover:text-label',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Calculator inputs */}
          <div className="bg-surface rounded-[10px] border border-black/[0.06] p-5 shadow-card space-y-4">
            <h2 className="text-sm font-semibold text-label">Pre-Qualification Calculator</h2>

            {/* Loan purpose */}
            <div>
              <label className="block text-xs font-medium text-label-2 mb-2">Loan Purpose</label>
              <div className="grid grid-cols-3 gap-2">
                {(['purchase', 'refinance', 'cash_out_refi'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setLoanPurpose(p)}
                    className={cn(
                      'py-2 px-2 rounded-[8px] text-xs font-medium transition-colors text-center',
                      loanPurpose === p ? 'bg-navy text-white' : 'bg-bg text-label-2 hover:bg-black/[0.08]',
                    )}
                  >
                    {p === 'purchase' ? 'Purchase' : p === 'refinance' ? 'Refinance' : 'Cash-Out'}
                  </button>
                ))}
              </div>
            </div>

            {/* Credit score */}
            <div>
              <label className="block text-xs font-medium text-label-2 mb-2">Credit Score Range</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['580-619', '620-659', '660-699', '700-719', '720-739', '740-759', '760+'] as CreditRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setCreditRange(r)}
                    className={cn(
                      'py-1.5 rounded-[7px] text-[11px] font-medium transition-colors',
                      creditRange === r ? 'bg-blue text-white' : 'bg-bg text-label-2 hover:bg-black/[0.08]',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Income */}
            <div>
              <label className="block text-xs font-medium text-label-2 mb-1">Annual Household Income</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3 text-sm">$</span>
                <input
                  type="text"
                  value={annualIncome}
                  onChange={(e) => setAnnualIncome(e.target.value)}
                  placeholder="120,000"
                  className="w-full pl-7 pr-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
              </div>
            </div>

            {/* Down payment */}
            {loanPurpose === 'purchase' && (
              <div>
                <label className="block text-xs font-medium text-label-2 mb-1">Down Payment</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3 text-sm">$</span>
                  <input
                    type="text"
                    value={downPayment}
                    onChange={(e) => setDownPayment(e.target.value)}
                    placeholder="40,000"
                    className="w-full pl-7 pr-3 py-2 rounded-[8px] border border-black/[0.12] bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-blue/20"
                  />
                </div>
              </div>
            )}

            <button
              onClick={calculate}
              className="w-full py-2.5 bg-navy text-white text-sm font-semibold rounded-[12px] hover:bg-navy/90 transition-colors flex items-center justify-center gap-2"
            >
              <Calculator size={16} />
              Calculate Pre-Qual
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {result ? (
              <>
                <div className="bg-surface rounded-[10px] border border-black/[0.06] p-5 shadow-card">
                  <h2 className="text-sm font-semibold text-label mb-4">Pre-Qualification Estimate</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-black/[0.06]">
                      <span className="text-sm text-label-2">Max Loan Amount</span>
                      <span className="text-lg font-bold text-navy">${result.maxLoanAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-black/[0.06]">
                      <span className="text-sm text-label-2">Rate Range</span>
                      <span className="text-sm font-semibold text-label">{result.estimatedRateMin}% – {result.estimatedRateMax}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-black/[0.06]">
                      <span className="text-sm text-label-2">Est. Monthly Payment</span>
                      <span className="text-sm font-semibold text-label">${result.estimatedPayment.toLocaleString()}/mo</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-label-2">Recommended Program</span>
                      <span className="text-sm font-bold text-blue">{PROGRAM_LABELS[result.recommendedProgram]}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-blue/10 border border-blue/20 rounded-[10px] p-4">
                  <p className="text-xs text-blue font-medium mb-1">Program Recommendation</p>
                  <p className="text-xs text-blue/80">{result.programNote}</p>
                </div>
                <div className="bg-surface rounded-[10px] border border-black/[0.06] p-4 shadow-card text-center">
                  <p className="text-sm font-semibold text-label">Ready to move forward?</p>
                  <p className="text-xs text-label-2 mt-1">A loan officer will contact you within 5 minutes.</p>
                </div>
              </>
            ) : (
              <div className="bg-surface rounded-[10px] border border-black/[0.06] p-10 shadow-card text-center">
                <DollarSign size={32} className="mx-auto text-label-3 mb-3" />
                <p className="text-sm text-label-2">Enter income and credit range to see instant pre-qual estimate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'rates' && (
        <div className="space-y-4">
          <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-black/[0.06]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-label">Current Market Rates</h2>
                  <p className="text-xs text-label-3 mt-0.5">Updated as of today · Source: Freddie Mac PMMS</p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange/10">
                  <Bell size={12} className="text-orange" />
                  <span className="text-xs text-orange font-medium">Rate alerts active</span>
                </div>
              </div>
            </div>
            <div className="divide-y divide-black/[0.06]">
              {MARKET_RATES.map((r) => (
                <div key={r.term} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm font-medium text-label">{r.term}</span>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      'text-[11px] font-medium',
                      r.trend === 'up' ? 'text-red' : r.trend === 'down' ? 'text-green' : 'text-label-3',
                    )}>
                      {r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→'} {r.change}
                    </span>
                    <span className="text-lg font-bold text-label">{r.rate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-[10px] border border-black/[0.06] p-5 shadow-card">
            <h2 className="text-sm font-semibold text-label mb-3">Rate Watch Alerts</h2>
            <p className="text-sm text-label-2 mb-4">Get notified when rates change to share with prospects and past clients.</p>
            <div className="space-y-3">
              {[
                { label: 'Alert me when 30-yr drops below', threshold: '6.5%' },
                { label: 'Alert me when 15-yr drops below', threshold: '5.875%' },
              ].map((a) => (
                <div key={a.label} className="flex items-center justify-between p-3 bg-bg rounded-[8px]">
                  <span className="text-sm text-label-2">{a.label}</span>
                  <span className="text-sm font-semibold text-blue">{a.threshold}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
