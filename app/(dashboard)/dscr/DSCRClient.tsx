'use client';

import { useState, useMemo } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  calculateDSCR,
  calculateBankStatementIncome,
  calculateAssetDepletion,
  calculatePLQualifier,
  calculateFixFlip,
  calculateMonthlyPayment,
} from '@/lib/pricing/calculator';
import { AlertTriangle, Save, TrendingUp, Building2 } from 'lucide-react';

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full h-9 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[13px] text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF]/40 transition-all';

const SELECT_CLS =
  'w-full h-9 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[13px] text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 appearance-none cursor-pointer';

function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function DollarInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#AEAEB2]">$</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(INPUT_CLS, 'pl-6')}
      />
    </div>
  );
}

function PctInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(INPUT_CLS, 'pr-6')}
        min={0}
        max={100}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#AEAEB2]">%</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-[#F2F2F7] rounded-xl p-3">
      <div className="text-[10px] text-[#AEAEB2] mb-1">{label}</div>
      <div className={cn('text-[22px] font-thin tabular-nums tracking-tight', color ?? 'text-[#0F1D2E]')}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-[#AEAEB2] mt-0.5">{sub}</div>}
    </div>
  );
}

function ResultRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-black/[0.04] last:border-0">
      <span className="text-[12px] text-[#6C6C70]">{label}</span>
      <span className={cn('text-[12px] font-medium tabular-nums', accent ? 'text-[#007AFF]' : 'text-[#0F1D2E]')}>
        {value}
      </span>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="text-[10px] text-[#AEAEB2] mt-4 leading-relaxed">
      For professional use only. Calculations are estimates and do not constitute a loan commitment.
      Subject to lender guidelines and underwriting approval.
    </p>
  );
}

// ─── Tab 1: DSCR Calculator ───────────────────────────────────────────────────

function DSCRTab() {
  const [rent, setRent] = useState('3500');
  const [loanAmt, setLoanAmt] = useState('400000');
  const [rate, setRate] = useState('7.625');
  const [taxes, setTaxes] = useState('400');
  const [insurance, setInsurance] = useState('150');
  const [vacancy, setVacancy] = useState('5');
  const [mgmt, setMgmt] = useState('8');
  const [hoa, setHoa] = useState('0');
  const [purchasePrice, setPurchasePrice] = useState('500000');

  const monthlyPI = useMemo(() => {
    const loan = parseFloat(loanAmt) || 0;
    const r = parseFloat(rate) || 0;
    return calculateMonthlyPayment(loan, r, 360);
  }, [loanAmt, rate]);

  const monthlyPITI = monthlyPI + (parseFloat(taxes) || 0) + (parseFloat(insurance) || 0);

  const result = useMemo(() =>
    calculateDSCR({
      monthlyGrossRent: parseFloat(rent) || 0,
      monthlyPITI,
      vacancyRatePct: parseFloat(vacancy) || 0,
      managementPct: parseFloat(mgmt) || 0,
      hoaMonthly: parseFloat(hoa) || 0,
      purchasePrice: parseFloat(purchasePrice) || undefined,
    }),
    [rent, monthlyPITI, vacancy, mgmt, hoa, purchasePrice]
  );

  const dscrColor =
    result.dscr >= 1.25
      ? 'text-[#34C759]'
      : result.dscr >= 1.0
      ? 'text-[#FF9500]'
      : 'text-[#FF3B30]';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      {/* Inputs */}
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 space-y-4">
          <h3 className="text-[13px] font-semibold text-[#0F1D2E]">Rental Income</h3>
          <InputField label="Monthly Gross Rent">
            <DollarInput value={rent} onChange={setRent} placeholder="3,500" />
          </InputField>
          <InputField label="Vacancy Rate">
            <PctInput value={vacancy} onChange={setVacancy} placeholder="5" />
          </InputField>
          <InputField label="Management Fee">
            <PctInput value={mgmt} onChange={setMgmt} placeholder="8" />
          </InputField>
          <InputField label="HOA (monthly)">
            <DollarInput value={hoa} onChange={setHoa} placeholder="0" />
          </InputField>
          <InputField label="Purchase Price (optional)">
            <DollarInput value={purchasePrice} onChange={setPurchasePrice} placeholder="500,000" />
          </InputField>
        </div>

        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 space-y-4">
          <h3 className="text-[13px] font-semibold text-[#0F1D2E]">Proposed Loan</h3>
          <InputField label="Loan Amount">
            <DollarInput value={loanAmt} onChange={setLoanAmt} />
          </InputField>
          <InputField label="Interest Rate">
            <PctInput value={rate} onChange={setRate} placeholder="7.625" />
          </InputField>
          <InputField label="Monthly Taxes">
            <DollarInput value={taxes} onChange={setTaxes} />
          </InputField>
          <InputField label="Monthly Insurance">
            <DollarInput value={insurance} onChange={setInsurance} />
          </InputField>
          <div className="bg-[#F2F2F7] rounded-xl p-3 text-[12px]">
            <div className="text-[#AEAEB2] mb-1">Monthly PITI</div>
            <div className="font-semibold text-[#0F1D2E] tabular-nums">{formatCurrency(monthlyPITI)}</div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {/* DSCR Hero */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-6">
          <div className="text-[12px] text-[#AEAEB2] mb-1">Debt Service Coverage Ratio</div>
          <div className={cn('text-[72px] font-thin tabular-nums tracking-tight leading-none mb-2', dscrColor)}>
            {result.dscr.toFixed(2)}
          </div>
          <div className="flex items-center gap-2 mb-4">
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-semibold',
                result.dscr >= 1.25
                  ? 'bg-[#34C759]/10 text-[#1a7a34]'
                  : result.dscr >= 1.0
                  ? 'bg-[#FF9500]/10 text-[#9a5700]'
                  : 'bg-[#FF3B30]/10 text-[#9a1f18]'
              )}
            >
              {result.dscr >= 1.25 ? 'Strong — Most Lenders' : result.dscr >= 1.0 ? 'Limited Lenders' : 'No-Ratio DSCR Only'}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <MetricCard label="Max Loan (DSCR 1.0)" value={formatCurrency(result.maxLoanAmount, { compact: true })} />
            <MetricCard
              label="Monthly Cash Flow"
              value={formatCurrency(result.cashFlowAfterDebt)}
              color={result.cashFlowAfterDebt >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}
            />
            {result.capRate !== null && (
              <MetricCard label="Cap Rate" value={`${(result.capRate * 100).toFixed(2)}%`} />
            )}
            <MetricCard label="Suggested Program" value={result.suggestedProgram} />
          </div>

          {/* Lender tier breakdown */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">
              Lender Tier Breakdown
            </div>
            {[
              {
                tier: 'DSCR ≥ 1.25',
                desc: 'Most DSCR lenders — best pricing',
                active: result.dscr >= 1.25,
                color: 'bg-[#34C759]/10 text-[#1a7a34]',
              },
              {
                tier: 'DSCR 1.0–1.24',
                desc: 'Limited lenders — rate premium applies',
                active: result.dscr >= 1.0 && result.dscr < 1.25,
                color: 'bg-[#FF9500]/10 text-[#9a5700]',
              },
              {
                tier: 'DSCR < 1.0',
                desc: 'No-ratio DSCR or Debt Coverage Note only',
                active: result.dscr < 1.0,
                color: 'bg-[#FF3B30]/10 text-[#9a1f18]',
              },
            ].map((t) => (
              <div
                key={t.tier}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-xl text-[12px]',
                  t.active ? t.color : 'bg-[#F2F2F7] text-[#AEAEB2]'
                )}
              >
                <span className="font-medium">{t.tier}</span>
                <span>{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium text-[#0F1D2E] hover:bg-black/[0.06] transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save Analysis
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium text-[#0F1D2E] hover:bg-black/[0.06] transition-colors">
            Attach to Lead
          </button>
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

// ─── Tab 2: Bank Statement Income ─────────────────────────────────────────────

function BankStatementTab() {
  const [period, setPeriod] = useState<12 | 24>(24);
  const [deposits12, setDeposits12] = useState('180000');
  const [deposits24, setDeposits24] = useState('360000');
  const [expenseRatio, setExpenseRatio] = useState('50');
  const [incomeType, setIncomeType] = useState<'business' | 'personal'>('business');
  const [existingDebts, setExistingDebts] = useState('1500');

  const effectiveExpenseRatio = incomeType === 'personal' ? '0' : expenseRatio;

  const result = useMemo(() =>
    calculateBankStatementIncome({
      deposits12mo: parseFloat(deposits12) || 0,
      deposits24mo: parseFloat(deposits24) || 0,
      expenseRatioPct: parseFloat(effectiveExpenseRatio) || 0,
      existingMonthlyDebts: parseFloat(existingDebts) || 0,
    }),
    [deposits12, deposits24, effectiveExpenseRatio, existingDebts]
  );

  const qualifying = period === 12 ? result.qualifying12mo : result.qualifying24mo;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            {(['business', 'personal'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setIncomeType(t);
                  if (t === 'personal') setExpenseRatio('0');
                  else setExpenseRatio('50');
                }}
                className={cn(
                  'flex-1 h-8 rounded-xl text-[12px] font-medium transition-colors capitalize',
                  incomeType === t
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-[#F2F2F7] text-[#6C6C70] hover:bg-black/[0.06]'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <InputField label="Total Deposits — 12 months">
            <DollarInput value={deposits12} onChange={setDeposits12} />
          </InputField>
          <InputField label="Total Deposits — 24 months">
            <DollarInput value={deposits24} onChange={setDeposits24} />
          </InputField>
          {incomeType === 'business' && (
            <InputField label="Expense Ratio">
              <PctInput value={expenseRatio} onChange={setExpenseRatio} placeholder="50" />
            </InputField>
          )}
          <InputField label="Existing Monthly Debts">
            <DollarInput value={existingDebts} onChange={setExistingDebts} />
          </InputField>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
          {/* Period toggle */}
          <div className="flex rounded-xl overflow-hidden border border-black/[0.06] mb-5 w-fit">
            {([12, 24] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-1.5 text-[12px] font-medium transition-colors',
                  period === p ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#6C6C70]'
                )}
              >
                {p}-Month
              </button>
            ))}
          </div>

          <div className="mb-2 text-[11px] text-[#AEAEB2]">Qualifying Monthly Income ({period}-month)</div>
          <div className="text-[56px] font-thin tabular-nums tracking-tight text-[#0F1D2E] mb-4">
            {formatCurrency(qualifying)}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard label="12-Month Qualifying" value={formatCurrency(result.qualifying12mo)} />
            <MetricCard label="24-Month Qualifying" value={formatCurrency(result.qualifying24mo)} />
          </div>

          <div className="space-y-0">
            <ResultRow label="Max Loan at 43% DTI (24mo)" value={formatCurrency(result.maxLoanAt43DTI, { compact: true })} accent />
          </div>

          <div className="mt-4 p-3 rounded-xl bg-[#007AFF]/[0.06] border border-[#007AFF]/20">
            <p className="text-[11px] text-[#007AFF] leading-relaxed">
              <strong>Lender note:</strong> Most lenders prefer 24-month average. Some allow 12-month
              if business is 2+ years old. Expense ratios vary by lender (40–60% typical for business).
            </p>
          </div>
        </div>

        <div className="flex justify-between">
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save Analysis
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            Attach to Lead
          </button>
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

// ─── Tab 3: Asset Depletion ───────────────────────────────────────────────────

function AssetDepletionTab() {
  const [assets, setAssets] = useState('1500000');
  const [liabilities, setLiabilities] = useState('200000');
  const [termMonths, setTermMonths] = useState('360');
  const [otherIncome, setOtherIncome] = useState('2000');
  const [existingDebts, setExistingDebts] = useState('1200');

  const result = useMemo(() =>
    calculateAssetDepletion({
      totalAssets: parseFloat(assets) || 0,
      liabilities: parseFloat(liabilities) || 0,
      remainingTermMonths: parseInt(termMonths) || 360,
      otherMonthlyIncome: parseFloat(otherIncome) || 0,
      existingMonthlyDebts: parseFloat(existingDebts) || 0,
    }),
    [assets, liabilities, termMonths, otherIncome, existingDebts]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 space-y-4">
        <InputField label="Total Verifiable Assets">
          <DollarInput value={assets} onChange={setAssets} />
        </InputField>
        <InputField label="Liabilities to be Paid">
          <DollarInput value={liabilities} onChange={setLiabilities} />
        </InputField>
        <InputField label="Loan Term (months)">
          <select
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="360">360 (30 yr)</option>
            <option value="300">300 (25 yr)</option>
            <option value="240">240 (20 yr)</option>
            <option value="180">180 (15 yr)</option>
          </select>
        </InputField>
        <InputField label="Other Monthly Income">
          <DollarInput value={otherIncome} onChange={setOtherIncome} />
        </InputField>
        <InputField label="Existing Monthly Debts">
          <DollarInput value={existingDebts} onChange={setExistingDebts} />
        </InputField>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
          <div className="text-[11px] text-[#AEAEB2] mb-1">Monthly Asset Depletion Income</div>
          <div className="text-[56px] font-thin tabular-nums tracking-tight text-[#0F1D2E] mb-4">
            {formatCurrency(result.monthlyDepletionIncome)}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard label="Total Qualifying Income" value={formatCurrency(result.totalQualifyingIncome)} />
            <MetricCard label="Max Loan Amount" value={formatCurrency(result.maxLoanAmount, { compact: true })} color="text-[#007AFF]" />
          </div>

          <div className="p-3 rounded-xl bg-[#F2F2F7]">
            <div className="text-[11px] text-[#AEAEB2] mb-2">Lender Requirements</div>
            <ul className="text-[12px] text-[#6C6C70] space-y-1">
              <li>• Most lenders use 70% of assets (already applied)</li>
              <li>• Remaining term must be ≥ 60 months post-depletion</li>
              <li>• Assets must be fully documented and verified</li>
              <li>• Retirement accounts may be discounted 30–40%</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-between">
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save Analysis
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            Attach to Lead
          </button>
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

// ─── Tab 4: P&L / 1099 ────────────────────────────────────────────────────────

function PLTab() {
  const [y1Income, setY1Income] = useState('180000');
  const [y2Income, setY2Income] = useState('210000');
  const [businessType, setBusinessType] = useState('sole_prop');
  const [ownershipPct, setOwnershipPct] = useState('100');
  const [depreciation, setDepreciation] = useState('15000');
  const [otherAddbacks, setOtherAddbacks] = useState('5000');
  const [existingDebts, setExistingDebts] = useState('2000');

  const result = useMemo(() =>
    calculatePLQualifier({
      year1NetIncome: parseFloat(y1Income) || 0,
      year2NetIncome: parseFloat(y2Income) || 0,
      ownershipPct: parseFloat(ownershipPct) || 100,
      depreciation: parseFloat(depreciation) || 0,
      otherAddbacks: parseFloat(otherAddbacks) || 0,
      existingMonthlyDebts: parseFloat(existingDebts) || 0,
    }),
    [y1Income, y2Income, ownershipPct, depreciation, otherAddbacks, existingDebts]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 space-y-4">
          <InputField label="Year 1 Net Income (P&L or 1099)">
            <DollarInput value={y1Income} onChange={setY1Income} />
          </InputField>
          <InputField label="Year 2 Net Income (most recent)">
            <DollarInput value={y2Income} onChange={setY2Income} />
          </InputField>
          <InputField label="Business Type">
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="sole_prop">Sole Proprietor (Schedule C)</option>
              <option value="s_corp">S-Corp (W-2 + K-1)</option>
              <option value="partnership">Partnership (K-1)</option>
              <option value="llc">LLC (Schedule C/E)</option>
            </select>
          </InputField>
          <InputField label="Ownership %">
            <PctInput value={ownershipPct} onChange={setOwnershipPct} />
          </InputField>
          <InputField label="Depreciation Add-back">
            <DollarInput value={depreciation} onChange={setDepreciation} />
          </InputField>
          <InputField label="Other Add-backs">
            <DollarInput value={otherAddbacks} onChange={setOtherAddbacks} />
          </InputField>
          <InputField label="Existing Monthly Debts">
            <DollarInput value={existingDebts} onChange={setExistingDebts} />
          </InputField>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
          <div className="text-[11px] text-[#AEAEB2] mb-1">Adjusted Monthly Qualifying Income</div>
          <div className="text-[56px] font-thin tabular-nums tracking-tight text-[#0F1D2E] mb-4">
            {formatCurrency(result.adjustedIncome)}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard label="2-Year Avg (monthly)" value={formatCurrency(result.twoYearAvg)} />
            <MetricCard label="Max Loan Amount" value={formatCurrency(result.maxLoanAmount, { compact: true })} color="text-[#007AFF]" />
          </div>

          <div className="p-3 rounded-xl bg-[#F2F2F7] text-[12px]">
            <div className="text-[11px] text-[#AEAEB2] mb-2 font-semibold uppercase tracking-wider">
              Common Add-backs
            </div>
            <div className="space-y-1 text-[#6C6C70]">
              <div className="flex justify-between"><span>Depreciation (Form 4562)</span><span className="text-[#34C759]">Eligible</span></div>
              <div className="flex justify-between"><span>Mileage (Schedule C)</span><span className="text-[#34C759]">Eligible</span></div>
              <div className="flex justify-between"><span>Non-recurring losses</span><span className="text-[#FF9500]">Case-by-case</span></div>
              <div className="flex justify-between"><span>Meals & Entertainment</span><span className="text-[#FF3B30]">Not eligible</span></div>
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save Analysis
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            Attach to Lead
          </button>
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

// ─── Tab 5: Fix & Flip / Bridge ───────────────────────────────────────────────

function FixFlipTab() {
  const [purchasePrice, setPurchasePrice] = useState('200000');
  const [arv, setArv] = useState('320000');
  const [rehab, setRehab] = useState('55000');
  const [holdMonths, setHoldMonths] = useState('8');
  const [carrying, setCarrying] = useState('2500');
  const [exitStrategy, setExitStrategy] = useState<'sell' | 'dscr_refi'>('sell');

  const result = useMemo(() =>
    calculateFixFlip({
      purchasePrice: parseFloat(purchasePrice) || 0,
      arv: parseFloat(arv) || 0,
      rehabBudget: parseFloat(rehab) || 0,
      holdMonths: parseInt(holdMonths) || 0,
      carryingCostsPerMonth: parseFloat(carrying) || 0,
    }),
    [purchasePrice, arv, rehab, holdMonths, carrying]
  );

  const profitColor =
    result.estimatedProfit > 0 ? 'text-[#34C759]' : 'text-[#FF3B30]';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5 space-y-4">
          <InputField label="Purchase Price">
            <DollarInput value={purchasePrice} onChange={setPurchasePrice} />
          </InputField>
          <InputField label="After-Repair Value (ARV)">
            <DollarInput value={arv} onChange={setArv} />
          </InputField>
          <InputField label="Rehab Budget">
            <DollarInput value={rehab} onChange={setRehab} />
          </InputField>
          <InputField label="Hold Period (months)">
            <input
              type="number"
              value={holdMonths}
              onChange={(e) => setHoldMonths(e.target.value)}
              className={INPUT_CLS}
              min={1}
              max={36}
            />
          </InputField>
          <InputField label="Carrying Costs / Month">
            <DollarInput value={carrying} onChange={setCarrying} />
          </InputField>
          <InputField label="Exit Strategy">
            <select
              value={exitStrategy}
              onChange={(e) => setExitStrategy(e.target.value as 'sell' | 'dscr_refi')}
              className={SELECT_CLS}
            >
              <option value="sell">Sell at ARV</option>
              <option value="dscr_refi">Refi to DSCR / Rental Hold</option>
            </select>
          </InputField>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
          <div className="text-[11px] text-[#AEAEB2] mb-1">Estimated Profit</div>
          <div className={cn('text-[56px] font-thin tabular-nums tracking-tight mb-4', profitColor)}>
            {formatCurrency(result.estimatedProfit)}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard label="Total Cost Basis" value={formatCurrency(result.totalCost, { compact: true })} />
            <MetricCard
              label="Estimated ROI"
              value={`${result.estimatedROI.toFixed(1)}%`}
              color={result.estimatedROI >= 20 ? 'text-[#34C759]' : result.estimatedROI >= 10 ? 'text-[#FF9500]' : 'text-[#FF3B30]'}
            />
            <MetricCard label="Max Loan (90% LTC / 70% ARV)" value={formatCurrency(result.maxLoan, { compact: true })} />
            <MetricCard label="Bridge Loan Size" value={formatCurrency(result.bridgeLoanSize, { compact: true })} color="text-[#007AFF]" />
          </div>

          {exitStrategy === 'dscr_refi' && (
            <div className="p-3 rounded-xl bg-[#007AFF]/[0.06] border border-[#007AFF]/20 text-[12px] text-[#007AFF]">
              <strong>Refi Readiness:</strong> At {formatCurrency(parseFloat(arv) || 0)} ARV, an 80% LTV
              DSCR loan would be {formatCurrency((parseFloat(arv) || 0) * 0.8)}. Run DSCR tab to
              confirm rental income coverage.
            </div>
          )}

          <div className="mt-4 p-3 rounded-xl bg-[#F2F2F7] text-[12px]">
            <div className="text-[11px] text-[#AEAEB2] mb-1">Bridge Loan Rules of Thumb</div>
            <div className="text-[#6C6C70] space-y-1">
              <div>• 90% LTC (loan-to-cost) or 70–75% ARV — lower prevails</div>
              <div>• 6–24 month terms typical</div>
              <div>• Interest-only payments common</div>
              <div>• Personal guarantee usually required</div>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save Analysis
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            Attach to Lead
          </button>
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

// ─── Non-QM Program Finder ────────────────────────────────────────────────────

const NON_QM_PROGRAMS = [
  {
    name: 'Bank Statement (12/24 mo)',
    minFico: 620,
    maxLTV: 85,
    ratePremium: '+0.75–1.25%',
    docs: '12 or 24 months business or personal bank statements',
    bestFor: 'Self-employed borrowers with strong deposits',
  },
  {
    name: 'DSCR / Investor',
    minFico: 660,
    maxLTV: 80,
    ratePremium: '+0.75–1.50%',
    docs: 'Rent schedule, lease agreements, title',
    bestFor: 'Real estate investors — no income docs required',
  },
  {
    name: 'Asset Depletion',
    minFico: 680,
    maxLTV: 80,
    ratePremium: '+0.50–1.00%',
    docs: '2 months asset statements, 70% usable',
    bestFor: 'High-net-worth retirees with limited income',
  },
  {
    name: 'Foreign National',
    minFico: 680,
    maxLTV: 65,
    ratePremium: '+1.50–2.50%',
    docs: 'Passport, visa, 6 months foreign bank statements',
    bestFor: 'Non-US citizens purchasing US investment property',
  },
  {
    name: 'ITIN Borrower',
    minFico: 640,
    maxLTV: 75,
    ratePremium: '+1.25–2.00%',
    docs: 'ITIN card, 2 years ITIN tax returns, bank statements',
    bestFor: 'Non-SSN borrowers with 2+ years US tax history',
  },
  {
    name: 'Recent Credit Event',
    minFico: 580,
    maxLTV: 75,
    ratePremium: '+2.00–3.50%',
    docs: 'Full income and asset docs, BK discharge / foreclosure date',
    bestFor: '1–4 years post-BK, foreclosure, or short sale',
  },
  {
    name: 'Interest Only',
    minFico: 700,
    maxLTV: 80,
    ratePremium: '+0.25–0.75%',
    docs: 'Standard full doc or bank statement',
    bestFor: 'Maximizing short-term cash flow, jumbo borrowers',
  },
  {
    name: '40-Year Term',
    minFico: 660,
    maxLTV: 80,
    ratePremium: '+0.50–1.00%',
    docs: 'Full doc or bank statement',
    bestFor: 'Reducing monthly payment on investment properties',
  },
];

function NonQMFinderTab() {
  const [creditScore, setCreditScore] = useState(680);
  const [incomeType, setIncomeType] = useState('self_employed');
  const [employment, setEmployment] = useState('self_employed');
  const [propertyType, setPropertyType] = useState('investment');

  const matches = NON_QM_PROGRAMS.filter((p) => p.minFico <= creditScore);

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">
                Credit Score
              </label>
              <span
                className={cn(
                  'text-[11px] font-semibold tabular-nums',
                  creditScore >= 720 ? 'text-[#34C759]' : creditScore >= 660 ? 'text-[#FF9500]' : 'text-[#FF3B30]'
                )}
              >
                {creditScore}
              </span>
            </div>
            <input
              type="range"
              min={580}
              max={850}
              step={5}
              value={creditScore}
              onChange={(e) => setCreditScore(Number(e.target.value))}
              className="w-full accent-[#007AFF]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">
              Income Type
            </label>
            <select
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="w2">W-2 Employee</option>
              <option value="self_employed">Self-Employed</option>
              <option value="1099">1099 Contractor</option>
              <option value="retired">Retired / Asset Income</option>
              <option value="foreign">Foreign National</option>
              <option value="itin">ITIN</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">
              Employment
            </label>
            <select
              value={employment}
              onChange={(e) => setEmployment(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="employed">Employed 2+ Years</option>
              <option value="self_employed">Self-Employed 2+ Years</option>
              <option value="recent_event">Recent Credit Event</option>
              <option value="no_income">No Income Required (DSCR)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">
              Property Type
            </label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="primary">Primary Residence</option>
              <option value="second">Second Home</option>
              <option value="investment">Investment Property</option>
            </select>
          </div>
        </div>
      </div>

      <div className="text-[12px] text-[#AEAEB2]">
        {matches.length} program{matches.length !== 1 ? 's' : ''} match this profile
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {NON_QM_PROGRAMS.map((prog) => {
          const eligible = prog.minFico <= creditScore;
          return (
            <div
              key={prog.name}
              className={cn(
                'bg-white rounded-2xl border shadow-sm p-4 transition-all',
                eligible ? 'border-black/[0.06]' : 'border-black/[0.04] opacity-50'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-[13px] font-semibold text-[#0F1D2E]">{prog.name}</div>
                {eligible ? (
                  <span className="text-[10px] font-semibold text-[#1a7a34] bg-[#34C759]/10 px-2 py-0.5 rounded-full">
                    Match
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-[#AEAEB2] bg-[#F2F2F7] px-2 py-0.5 rounded-full">
                    FICO too low
                  </span>
                )}
              </div>
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[#AEAEB2]">Min FICO</span>
                  <span className="font-medium tabular-nums text-[#0F1D2E]">{prog.minFico}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#AEAEB2]">Max LTV</span>
                  <span className="font-medium tabular-nums text-[#0F1D2E]">{prog.maxLTV}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#AEAEB2]">Rate Premium</span>
                  <span className="font-medium text-[#FF9500]">{prog.ratePremium}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-black/[0.06]">
                <div className="text-[10px] text-[#AEAEB2] uppercase tracking-wider mb-1">Docs</div>
                <p className="text-[11px] text-[#6C6C70] leading-relaxed">{prog.docs}</p>
                <div className="text-[10px] text-[#AEAEB2] uppercase tracking-wider mt-2 mb-1">Best For</div>
                <p className="text-[11px] text-[#6C6C70]">{prog.bestFor}</p>
              </div>
            </div>
          );
        })}
      </div>
      <Disclaimer />
    </div>
  );
}

// ─── Main DSCR Page ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'dscr', label: 'DSCR Calculator' },
  { id: 'bank_stmt', label: 'Bank Statement' },
  { id: 'asset_dep', label: 'Asset Depletion' },
  { id: 'pl', label: 'P&L / 1099' },
  { id: 'fix_flip', label: 'Fix & Flip' },
  { id: 'nonqm', label: 'Non-QM Finder' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function DSCRClient() {
  const [activeTab, setActiveTab] = useState<TabId>('dscr');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-5 h-5 text-[#007AFF]" />
          <h1 className="text-2xl font-semibold text-[#0F1D2E] tracking-tight">DSCR / Non-QM Suite</h1>
        </div>
        <p className="text-[#AEAEB2] text-sm">
          Qualification tools for investment and non-traditional income borrowers.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[#F2F2F7] rounded-2xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-shrink-0 px-3 py-2 rounded-xl text-[12px] font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white text-[#0F1D2E] shadow-sm'
                : 'text-[#6C6C70] hover:text-[#0F1D2E]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'dscr' && <DSCRTab />}
      {activeTab === 'bank_stmt' && <BankStatementTab />}
      {activeTab === 'asset_dep' && <AssetDepletionTab />}
      {activeTab === 'pl' && <PLTab />}
      {activeTab === 'fix_flip' && <FixFlipTab />}
      {activeTab === 'nonqm' && <NonQMFinderTab />}
    </div>
  );
}
