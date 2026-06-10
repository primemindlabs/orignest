'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Calculator,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Save,
  Send,
  ChevronDown,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  checkEligibility,
  calculateLoanAmount,
  type EligibilityResult,
  type EligibilityParams,
  type LoanProgram,
} from '@/lib/pricing/calculator';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROGRAM_LABELS: Record<LoanProgram, string> = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  jumbo: 'Jumbo',
  dscr: 'DSCR',
  bank_statement: 'Bank Statement',
  fha_203k: 'FHA 203(k)',
};

const PROPERTY_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'multi_family', label: 'Multi-Family (2-4 unit)' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'manufactured', label: 'Manufactured' },
];

const OCCUPANCY_TYPES = [
  { value: 'primary', label: 'Primary Residence' },
  { value: 'second', label: 'Second Home' },
  { value: 'investment', label: 'Investment Property' },
];

const LOAN_PURPOSES = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'refinance', label: 'Rate / Term Refi' },
  { value: 'cash_out_refi', label: 'Cash-Out Refi' },
  { value: 'heloc', label: 'HELOC' },
];

const TERM_OPTIONS = [
  { value: 360, label: '30 yr' },
  { value: 300, label: '25 yr' },
  { value: 240, label: '20 yr' },
  { value: 180, label: '15 yr' },
  { value: 120, label: '10 yr' },
];

const LOCK_PERIODS = [
  { value: 15, label: '15 days' },
  { value: 30, label: '30 days' },
  { value: 45, label: '45 days' },
  { value: 60, label: '60 days' },
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: EligibilityResult['status'] }) {
  if (status === 'eligible')
    return <CheckCircle2 className="w-4 h-4 text-[#34C759]" />;
  if (status === 'conditional')
    return <AlertTriangle className="w-4 h-4 text-[#FF9500]" />;
  return <XCircle className="w-4 h-4 text-[#FF3B30]" />;
}

function StatusBadge({ status }: { status: EligibilityResult['status'] }) {
  const map = {
    eligible: 'bg-[#34C759]/10 text-[#1a7a34]',
    conditional: 'bg-[#FF9500]/10 text-[#9a5700]',
    ineligible: 'bg-[#FF3B30]/10 text-[#9a1f18]',
  };
  const labels = { eligible: 'Eligible', conditional: 'Conditional', ineligible: 'Not Eligible' };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', map[status])}>
      <StatusIcon status={status} />
      {labels[status]}
    </span>
  );
}

function DTIBadge({ value, label }: { value: number; label: string }) {
  const color =
    value < 36 ? 'text-[#34C759]' : value <= 43 ? 'text-[#FF9500]' : 'text-[#FF3B30]';
  return (
    <div className="text-center">
      <div className={cn('text-lg font-thin tabular-nums tracking-tight', color)}>
        {value.toFixed(1)}%
      </div>
      <div className="text-[10px] text-[#AEAEB2] mt-0.5">{label} DTI</div>
    </div>
  );
}

function ScenarioCard({ result }: { result: EligibilityResult }) {
  const [expanded, setExpanded] = useState(false);
  const isIneligible = result.status === 'ineligible';

  return (
    <div
      className={cn(
        'rounded-2xl border shadow-sm p-4 transition-all',
        isIneligible
          ? 'bg-[#F2F2F7] border-black/[0.06] opacity-60'
          : 'bg-white border-black/[0.06]'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[13px] font-semibold text-[#0F1D2E]">
            {PROGRAM_LABELS[result.program]}
          </div>
          <div className="mt-1">
            <StatusBadge status={result.status} />
          </div>
        </div>
        {!isIneligible && (
          <div className="text-right">
            <div className="text-[11px] text-[#AEAEB2]">Rate (indicative)</div>
            <div className="text-[18px] font-thin tabular-nums tracking-tight text-[#0F1D2E]">
              {result.rateRangeLow.toFixed(3)}%
              <span className="text-[13px] text-[#6C6C70]"> – {result.rateRangeHigh.toFixed(3)}%</span>
            </div>
          </div>
        )}
      </div>

      {result.reason && (
        <div className="flex items-start gap-1.5 mb-3 p-2 rounded-xl bg-black/[0.03]">
          <Info className="w-3.5 h-3.5 text-[#AEAEB2] mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-[#6C6C70] leading-relaxed">{result.reason}</p>
        </div>
      )}

      {!isIneligible && (
        <>
          {/* Key metrics row */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-[#F2F2F7] rounded-xl p-2.5">
              <div className="text-[10px] text-[#AEAEB2] mb-0.5">Monthly P&amp;I</div>
              <div className="text-[18px] font-thin tabular-nums tracking-tight text-[#0F1D2E]">
                {formatCurrency(result.monthlyPI)}
              </div>
            </div>
            <div className="bg-[#F2F2F7] rounded-xl p-2.5">
              <div className="text-[10px] text-[#AEAEB2] mb-0.5">Monthly Total (PITI)</div>
              <div className="text-[18px] font-thin tabular-nums tracking-tight text-[#0F1D2E]">
                {formatCurrency(result.monthlyTotal)}
              </div>
            </div>
          </div>

          {/* DTI row */}
          <div className="flex justify-around mb-3 py-2 border-y border-black/[0.06]">
            <DTIBadge value={result.frontDTI} label="Front" />
            <DTIBadge value={result.backDTI} label="Back" />
            <div className="text-center">
              <div className="text-lg font-thin tabular-nums tracking-tight text-[#0F1D2E]">
                {result.ltv.toFixed(1)}%
              </div>
              <div className="text-[10px] text-[#AEAEB2] mt-0.5">LTV</div>
            </div>
          </div>

          {/* Expandable details */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-[#C9A95C] font-medium mb-2"
          >
            <ChevronDown
              className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')}
            />
            {expanded ? 'Hide details' : 'Show details'}
          </button>

          {expanded && (
            <div className="space-y-1.5 text-[12px]">
              <Row label="APR (est.)" value={`${result.apr.toFixed(3)}%`} />
              {result.monthlyMI > 0 && (
                <Row label="Monthly MI" value={formatCurrency(result.monthlyMI)} />
              )}
              <Row label="Cash to Close (est.)" value={formatCurrency(result.cashToClose)} />
              <Row
                label="Total Interest (life)"
                value={formatCurrency(result.totalInterest)}
                muted
              />
              <Row label="Loan Amount" value={formatCurrency(result.loanAmount)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#AEAEB2]">{label}</span>
      <span className={cn('font-medium tabular-nums', muted ? 'text-[#AEAEB2]' : 'text-[#0F1D2E]')}>
        {value}
      </span>
    </div>
  );
}

function InputField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT_CLS =
  'w-full h-9 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[13px] text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 focus:border-[#C9A95C]/40 transition-all';

const SELECT_CLS =
  'w-full h-9 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[13px] text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#C9A95C]/30 appearance-none cursor-pointer';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PricingClient() {
  // Borrower profile
  const [creditScore, setCreditScore] = useState(720);
  const [annualIncome, setAnnualIncome] = useState('120000');
  const [monthlyDebts, setMonthlyDebts] = useState('500');
  const [vaEligible, setVaEligible] = useState(false);

  // Property
  const [purchasePrice, setPurchasePrice] = useState('450000');
  const [downPaymentMode, setDownPaymentMode] = useState<'amount' | 'pct'>('amount');
  const [downPaymentAmt, setDownPaymentAmt] = useState('90000');
  const [downPaymentPct, setDownPaymentPct] = useState('20');
  const [propertyType, setPropertyType] = useState('single_family');
  const [occupancy, setOccupancy] = useState('primary');
  const [state, setState] = useState('GA');

  // Loan
  const [loanPurpose, setLoanPurpose] = useState('purchase');
  const [termMonths, setTermMonths] = useState(360);
  const [lockPeriod, setLockPeriod] = useState(30);
  const [rentalIncome, setRentalIncome] = useState('');

  const [saved, setSaved] = useState(false);

  // Derive down payment
  const price = parseFloat(purchasePrice) || 0;
  const downAmt =
    downPaymentMode === 'amount'
      ? parseFloat(downPaymentAmt) || 0
      : (price * (parseFloat(downPaymentPct) || 0)) / 100;

  const loanAmt = calculateLoanAmount(price, downAmt);

  const params: EligibilityParams = useMemo(
    () => ({
      creditScore,
      annualIncome: parseFloat(annualIncome) || 0,
      monthlyDebts: parseFloat(monthlyDebts) || 0,
      purchasePrice: price,
      downPaymentAmount: downAmt,
      propertyType,
      occupancy,
      state,
      loanPurpose,
      termMonths,
      vaEligible,
      rentalIncome: parseFloat(rentalIncome) || 0,
    }),
    [
      creditScore, annualIncome, monthlyDebts, price, downAmt,
      propertyType, occupancy, state, loanPurpose, termMonths,
      vaEligible, rentalIncome,
    ]
  );

  const results = useMemo(() => checkEligibility(params), [params]);
  // Show top 4
  const topResults = results.slice(0, 4);

  const handleSave = useCallback(async () => {
    try {
      await fetch('/api/pricing/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ params, results: topResults }) });
    } catch { /* best-effort; UI still confirms */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [params, topResults]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F1D2E] tracking-tight">Pricing Engine</h1>
          <p className="text-[#AEAEB2] text-sm mt-0.5">
            Scenario comparison across loan programs — auto-calculates on change.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium text-[#0F1D2E] hover:bg-black/[0.06] transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saved ? 'Saved!' : 'Save Scenario'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium text-[#0F1D2E] hover:bg-black/[0.06] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#C9A95C] text-[12px] font-medium text-white hover:bg-[#C9A95C]/90 transition-colors">
            <Send className="w-3.5 h-3.5" />
            Send to Borrower
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        {/* ── Left panel: Inputs ── */}
        <div className="space-y-5">
          {/* Borrower Profile */}
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-[#C9A95C]" />
              <h2 className="text-[13px] font-semibold text-[#0F1D2E]">Borrower Profile</h2>
            </div>
            <div className="space-y-4">
              {/* Credit Score Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">
                    Credit Score
                  </label>
                  <div
                    className={cn(
                      'text-[13px] font-semibold tabular-nums px-2 py-0.5 rounded-lg',
                      creditScore >= 740
                        ? 'bg-[#34C759]/10 text-[#1a7a34]'
                        : creditScore >= 680
                        ? 'bg-[#FF9500]/10 text-[#9a5700]'
                        : 'bg-[#FF3B30]/10 text-[#9a1f18]'
                    )}
                  >
                    {creditScore}
                  </div>
                </div>
                <input
                  type="range"
                  min={580}
                  max={850}
                  step={5}
                  value={creditScore}
                  onChange={(e) => setCreditScore(Number(e.target.value))}
                  className="w-full accent-[#C9A95C]"
                />
                <div className="flex justify-between text-[10px] text-[#AEAEB2] mt-0.5">
                  <span>580</span>
                  <span>620</span>
                  <span>680</span>
                  <span>740</span>
                  <span>850</span>
                </div>
              </div>

              <InputField label="Annual Income">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#AEAEB2]">
                    $
                  </span>
                  <input
                    type="number"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(e.target.value)}
                    className={cn(INPUT_CLS, 'pl-6')}
                    placeholder="120,000"
                  />
                </div>
              </InputField>

              <InputField label="Monthly Debts">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#AEAEB2]">
                    $
                  </span>
                  <input
                    type="number"
                    value={monthlyDebts}
                    onChange={(e) => setMonthlyDebts(e.target.value)}
                    className={cn(INPUT_CLS, 'pl-6')}
                    placeholder="500"
                  />
                </div>
              </InputField>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="va"
                  checked={vaEligible}
                  onChange={(e) => setVaEligible(e.target.checked)}
                  className="w-4 h-4 accent-[#C9A95C] rounded"
                />
                <label htmlFor="va" className="text-[12px] text-[#0F1D2E] cursor-pointer">
                  VA Eligible Borrower
                </label>
              </div>
            </div>
          </div>

          {/* Property */}
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
            <h2 className="text-[13px] font-semibold text-[#0F1D2E] mb-4">Property</h2>
            <div className="space-y-4">
              <InputField label="Purchase Price / Value">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#AEAEB2]">
                    $
                  </span>
                  <input
                    type="number"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className={cn(INPUT_CLS, 'pl-6')}
                    placeholder="450,000"
                  />
                </div>
              </InputField>

              {/* Down payment mode toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">
                    Down Payment
                  </label>
                  <div className="flex rounded-lg overflow-hidden border border-black/[0.06]">
                    {(['amount', 'pct'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setDownPaymentMode(m)}
                        className={cn(
                          'px-2.5 py-1 text-[11px] font-medium transition-colors',
                          downPaymentMode === m
                            ? 'bg-[#C9A95C] text-white'
                            : 'bg-[#F2F2F7] text-[#6C6C70]'
                        )}
                      >
                        {m === 'amount' ? '$' : '%'}
                      </button>
                    ))}
                  </div>
                </div>
                {downPaymentMode === 'amount' ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#AEAEB2]">
                      $
                    </span>
                    <input
                      type="number"
                      value={downPaymentAmt}
                      onChange={(e) => setDownPaymentAmt(e.target.value)}
                      className={cn(INPUT_CLS, 'pl-6')}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="number"
                      value={downPaymentPct}
                      onChange={(e) => setDownPaymentPct(e.target.value)}
                      className={cn(INPUT_CLS, 'pr-6')}
                      min={0}
                      max={100}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#AEAEB2]">
                      %
                    </span>
                  </div>
                )}
                <div className="text-[11px] text-[#AEAEB2] mt-1">
                  Loan amount:{' '}
                  <span className="font-medium text-[#0F1D2E] tabular-nums">
                    {formatCurrency(loanAmt)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InputField label="Property Type">
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className={SELECT_CLS}
                  >
                    {PROPERTY_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </InputField>
                <InputField label="Occupancy">
                  <select
                    value={occupancy}
                    onChange={(e) => setOccupancy(e.target.value)}
                    className={SELECT_CLS}
                  >
                    {OCCUPANCY_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </InputField>
              </div>

              <InputField label="State">
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className={SELECT_CLS}
                >
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </InputField>
            </div>
          </div>

          {/* Loan */}
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
            <h2 className="text-[13px] font-semibold text-[#0F1D2E] mb-4">Loan</h2>
            <div className="space-y-4">
              <InputField label="Loan Purpose">
                <select
                  value={loanPurpose}
                  onChange={(e) => setLoanPurpose(e.target.value)}
                  className={SELECT_CLS}
                >
                  {LOAN_PURPOSES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </InputField>

              <div className="grid grid-cols-2 gap-3">
                <InputField label="Term">
                  <select
                    value={termMonths}
                    onChange={(e) => setTermMonths(Number(e.target.value))}
                    className={SELECT_CLS}
                  >
                    {TERM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </InputField>
                <InputField label="Lock Period">
                  <select
                    value={lockPeriod}
                    onChange={(e) => setLockPeriod(Number(e.target.value))}
                    className={SELECT_CLS}
                  >
                    {LOCK_PERIODS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </InputField>
              </div>

              {(occupancy === 'investment' || loanPurpose === 'purchase') && (
                <InputField label="Monthly Rental Income (DSCR)">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#AEAEB2]">
                      $
                    </span>
                    <input
                      type="number"
                      value={rentalIncome}
                      onChange={(e) => setRentalIncome(e.target.value)}
                      className={cn(INPUT_CLS, 'pl-6')}
                      placeholder="Optional — for DSCR calc"
                    />
                  </div>
                </InputField>
              )}
            </div>
          </div>
        </div>

        {/* ── Right panel: Scenario results ── */}
        <div className="space-y-4">
          {/* Rate disclaimer */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FF9500]/10 border border-[#FF9500]/20">
            <AlertTriangle className="w-3.5 h-3.5 text-[#FF9500] flex-shrink-0" />
            <p className="text-[11px] text-[#9a5700]">
              <strong>Indicative only — contact lender for exact pricing.</strong> Rates shown are
              market estimates and do not constitute a loan commitment. Subject to lender guidelines
              and underwriting approval.
            </p>
          </div>

          {/* Scenario cards grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {topResults.map((result) => (
              <ScenarioCard key={result.program} result={result} />
            ))}
          </div>

          {/* Locked programs */}
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-lg bg-[#F2F2F7] flex items-center justify-center">
                <span className="text-[10px]">🔒</span>
              </div>
              <span className="text-[12px] font-semibold text-[#0F1D2E]">Coming Soon</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['FHA 203(k)', 'Construction', 'Reverse Mortgage'].map((p) => (
                <span
                  key={p}
                  className="px-2.5 py-1 rounded-lg bg-[#F2F2F7] text-[11px] text-[#AEAEB2] font-medium"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          {/* Disclaimer footer */}
          <p className="text-[10px] text-[#AEAEB2] leading-relaxed">
            For professional use only. Calculations are estimates and do not constitute a loan
            commitment. Subject to lender guidelines and underwriting approval. NMLS disclosures
            required at point of loan application.
          </p>
        </div>
      </div>
    </div>
  );
}
