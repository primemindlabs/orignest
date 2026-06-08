'use client';

import { useState, useMemo } from 'react';
import { Building2, Plus, AlertTriangle, Save, Calendar } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  calculateCommercialNOI,
  calculateSBA,
  calculateMonthlyPayment,
} from '@/lib/pricing/calculator';

// ─── Shared UI helpers ─────────────────────────────────────────────────────────

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
  large = false,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  large?: boolean;
}) {
  return (
    <div className="bg-[#F2F2F7] rounded-xl p-3">
      <div className="text-[10px] text-[#AEAEB2] mb-1">{label}</div>
      <div className={cn('font-thin tabular-nums tracking-tight', large ? 'text-[28px]' : 'text-[20px]', color ?? 'text-[#0F1D2E]')}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-[#AEAEB2] mt-0.5">{sub}</div>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
      <h3 className="text-[13px] font-semibold text-[#0F1D2E] mb-4">{title}</h3>
      {children}
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

// ─── Tab 1: NOI & Cap Rate ─────────────────────────────────────────────────────

function NOITab() {
  const [grossRent, setGrossRent] = useState('180000');
  const [vacancy, setVacancy] = useState('5');
  const [propTax, setPropTax] = useState('18000');
  const [insurance, setInsurance] = useState('6000');
  const [maintenance, setMaintenance] = useState('9000');
  const [management, setManagement] = useState('14400');
  const [utilities, setUtilities] = useState('3600');
  const [capex, setCapex] = useState('7200');
  const [purchasePrice, setPurchasePrice] = useState('2000000');
  const [marketCapRate, setMarketCapRate] = useState('6.5');
  const [annualDebtService, setAnnualDebtService] = useState('');

  const result = useMemo(() =>
    calculateCommercialNOI({
      grossRentalIncome: parseFloat(grossRent) || 0,
      vacancyRatePct: parseFloat(vacancy) || 0,
      propertyTax: parseFloat(propTax) || 0,
      insurance: parseFloat(insurance) || 0,
      maintenance: parseFloat(maintenance) || 0,
      management: parseFloat(management) || 0,
      utilities: parseFloat(utilities) || 0,
      capexReserve: parseFloat(capex) || 0,
      purchasePrice: parseFloat(purchasePrice) || undefined,
      annualDebtService: parseFloat(annualDebtService) || undefined,
      marketCapRate: parseFloat(marketCapRate) || undefined,
    }),
    [grossRent, vacancy, propTax, insurance, maintenance, management, utilities, capex, purchasePrice, annualDebtService, marketCapRate]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <SectionCard title="Income">
          <div className="space-y-3">
            <InputField label="Gross Rental Income (annual)">
              <DollarInput value={grossRent} onChange={setGrossRent} />
            </InputField>
            <InputField label="Vacancy Rate">
              <PctInput value={vacancy} onChange={setVacancy} />
            </InputField>
          </div>
        </SectionCard>
        <SectionCard title="Operating Expenses (annual)">
          <div className="space-y-3">
            <InputField label="Property Tax">
              <DollarInput value={propTax} onChange={setPropTax} />
            </InputField>
            <InputField label="Insurance">
              <DollarInput value={insurance} onChange={setInsurance} />
            </InputField>
            <InputField label="Maintenance & Repairs">
              <DollarInput value={maintenance} onChange={setMaintenance} />
            </InputField>
            <InputField label="Property Management">
              <DollarInput value={management} onChange={setManagement} />
            </InputField>
            <InputField label="Utilities">
              <DollarInput value={utilities} onChange={setUtilities} />
            </InputField>
            <InputField label="CapEx Reserve">
              <DollarInput value={capex} onChange={setCapex} />
            </InputField>
          </div>
        </SectionCard>
        <SectionCard title="Valuation Inputs">
          <div className="space-y-3">
            <InputField label="Purchase / Assessed Price">
              <DollarInput value={purchasePrice} onChange={setPurchasePrice} />
            </InputField>
            <InputField label="Market Cap Rate">
              <PctInput value={marketCapRate} onChange={setMarketCapRate} />
            </InputField>
            <InputField label="Annual Debt Service (optional)">
              <DollarInput value={annualDebtService} onChange={setAnnualDebtService} />
            </InputField>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-6">
          <div className="text-[11px] text-[#AEAEB2] mb-1">Net Operating Income</div>
          <div className="text-[64px] font-thin tabular-nums tracking-tight text-[#0F1D2E] mb-1">
            {formatCurrency(result.noi)}
          </div>
          <div className="text-[12px] text-[#AEAEB2]">Annual NOI</div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <MetricCard
              label="Effective Gross Income"
              value={formatCurrency(result.effectiveGrossIncome, { compact: true })}
            />
            {result.capRate !== null && (
              <MetricCard
                label="Cap Rate"
                value={`${(result.capRate * 100).toFixed(2)}%`}
                color={result.capRate * 100 >= 7 ? 'text-[#34C759]' : result.capRate * 100 >= 5 ? 'text-[#FF9500]' : 'text-[#FF3B30]'}
              />
            )}
            {result.valueAtCapRate !== null && (
              <MetricCard
                label={`Value at ${marketCapRate}% Cap`}
                value={formatCurrency(result.valueAtCapRate, { compact: true })}
                color="text-[#007AFF]"
              />
            )}
            {result.dscr !== null && (
              <MetricCard
                label="DSCR"
                value={result.dscr.toFixed(2)}
                color={result.dscr >= 1.25 ? 'text-[#34C759]' : result.dscr >= 1.0 ? 'text-[#FF9500]' : 'text-[#FF3B30]'}
              />
            )}
          </div>

          {/* Expense breakdown */}
          <div className="mt-4 border-t border-black/[0.06] pt-4">
            <div className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-3">
              Income Statement
            </div>
            <div className="space-y-1.5 text-[12px]">
              <div className="flex justify-between font-medium">
                <span className="text-[#0F1D2E]">Gross Rental Income</span>
                <span className="tabular-nums">{formatCurrency(parseFloat(grossRent) || 0)}</span>
              </div>
              <div className="flex justify-between text-[#FF3B30]">
                <span>Vacancy ({vacancy}%)</span>
                <span className="tabular-nums">
                  ({formatCurrency((parseFloat(grossRent) || 0) * (parseFloat(vacancy) || 0) / 100)})
                </span>
              </div>
              <div className="flex justify-between font-medium border-b border-black/[0.06] pb-1.5">
                <span className="text-[#0F1D2E]">Effective Gross Income</span>
                <span className="tabular-nums">{formatCurrency(result.effectiveGrossIncome)}</span>
              </div>
              {[
                ['Property Tax', propTax],
                ['Insurance', insurance],
                ['Maintenance', maintenance],
                ['Management', management],
                ['Utilities', utilities],
                ['CapEx Reserve', capex],
              ].map(([label, val]) => {
                const num = parseFloat(val) || 0;
                if (num === 0) return null;
                return (
                  <div key={label} className="flex justify-between text-[#6C6C70]">
                    <span>{label}</span>
                    <span className="tabular-nums text-[#FF3B30]">({formatCurrency(num)})</span>
                  </div>
                );
              })}
              <div className="flex justify-between font-semibold border-t border-black/[0.06] pt-1.5 mt-1">
                <span className="text-[#0F1D2E]">Net Operating Income</span>
                <span className="tabular-nums text-[#34C759]">{formatCurrency(result.noi)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save Deal
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

// ─── Tab 2: Commercial DSCR ───────────────────────────────────────────────────

function CommercialDSCRTab() {
  const [noi, setNoi] = useState('120000');
  const [loanAmount, setLoanAmount] = useState('1500000');
  const [rate, setRate] = useState('7.25');
  const [term, setTerm] = useState('300');
  const [useManualDebtService, setUseManualDebtService] = useState(false);
  const [manualDebtService, setManualDebtService] = useState('');

  const calcMonthlyPayment = calculateMonthlyPayment(
    parseFloat(loanAmount) || 0,
    parseFloat(rate) || 0,
    parseInt(term) || 300
  );
  const annualDebtService = useManualDebtService
    ? (parseFloat(manualDebtService) || 0)
    : calcMonthlyPayment * 12;

  const noiVal = parseFloat(noi) || 0;
  const loanAmt = parseFloat(loanAmount) || 0;

  const dscr = annualDebtService > 0 ? noiVal / annualDebtService : 0;
  const debtYield = loanAmt > 0 ? (noiVal / loanAmt) * 100 : 0;

  const THRESHOLDS = [1.2, 1.25, 1.3, 1.35, 1.4];

  function maxLoanAtDSCR(targetDSCR: number): number {
    // Max annual debt service = NOI / targetDSCR
    const maxADS = noiVal / targetDSCR;
    const maxMonthly = maxADS / 12;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = parseInt(term) || 300;
    if (r === 0 || n === 0) return 0;
    return (maxMonthly * (1 - Math.pow(1 + r, -n))) / r;
  }

  const dscrColor =
    dscr >= 1.3 ? 'text-[#34C759]' : dscr >= 1.2 ? 'text-[#FF9500]' : 'text-[#FF3B30]';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      <div className="space-y-4">
        <SectionCard title="NOI & Loan">
          <div className="space-y-3">
            <InputField label="Annual NOI">
              <DollarInput value={noi} onChange={setNoi} />
            </InputField>
            <InputField label="Loan Amount">
              <DollarInput value={loanAmount} onChange={setLoanAmount} />
            </InputField>
            <InputField label="Interest Rate">
              <PctInput value={rate} onChange={setRate} />
            </InputField>
            <InputField label="Amortization (months)">
              <select value={term} onChange={(e) => setTerm(e.target.value)} className={SELECT_CLS}>
                <option value="360">360 (30 yr)</option>
                <option value="300">300 (25 yr)</option>
                <option value="240">240 (20 yr)</option>
                <option value="180">180 (15 yr)</option>
              </select>
            </InputField>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="manualDS"
                checked={useManualDebtService}
                onChange={(e) => setUseManualDebtService(e.target.checked)}
                className="w-4 h-4 accent-[#007AFF]"
              />
              <label htmlFor="manualDS" className="text-[12px] text-[#0F1D2E] cursor-pointer">
                Enter annual debt service manually
              </label>
            </div>
            {useManualDebtService && (
              <InputField label="Annual Debt Service">
                <DollarInput value={manualDebtService} onChange={setManualDebtService} />
              </InputField>
            )}
            {!useManualDebtService && (
              <div className="bg-[#F2F2F7] rounded-xl p-3 text-[12px]">
                <div className="text-[#AEAEB2] mb-1">Calculated Annual Debt Service</div>
                <div className="font-semibold text-[#0F1D2E] tabular-nums">
                  {formatCurrency(annualDebtService)}
                  <span className="text-[#AEAEB2] font-normal ml-1">
                    ({formatCurrency(calcMonthlyPayment)}/mo)
                  </span>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-6">
          <div className="text-[11px] text-[#AEAEB2] mb-1">Commercial DSCR</div>
          <div className={cn('text-[72px] font-thin tabular-nums tracking-tight leading-none mb-3', dscrColor)}>
            {dscr.toFixed(2)}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <MetricCard label="Annual NOI" value={formatCurrency(noiVal, { compact: true })} />
            <MetricCard label="Annual Debt Service" value={formatCurrency(annualDebtService, { compact: true })} />
            <MetricCard
              label="Debt Yield"
              value={`${debtYield.toFixed(2)}%`}
              sub="NOI ÷ Loan Amount"
              color={debtYield >= 8 ? 'text-[#34C759]' : debtYield >= 6 ? 'text-[#FF9500]' : 'text-[#FF3B30]'}
            />
            <MetricCard
              label="LTV Check"
              value={`—`}
              sub="Enter purchase price in NOI tab"
            />
          </div>

          {/* DSCR threshold table */}
          <div className="border-t border-black/[0.06] pt-4">
            <div className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-3">
              Max Loan by DSCR Threshold
            </div>
            <div className="space-y-2">
              {THRESHOLDS.map((threshold) => {
                const maxLoan = maxLoanAtDSCR(threshold);
                const isCurrentOk = dscr >= threshold;
                return (
                  <div
                    key={threshold}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-xl text-[12px]',
                      isCurrentOk ? 'bg-[#34C759]/10' : 'bg-[#F2F2F7]'
                    )}
                  >
                    <span className={cn('font-medium', isCurrentOk ? 'text-[#1a7a34]' : 'text-[#AEAEB2]')}>
                      DSCR {threshold.toFixed(2)}x
                    </span>
                    <span className={cn('tabular-nums font-semibold', isCurrentOk ? 'text-[#1a7a34]' : 'text-[#AEAEB2]')}>
                      {formatCurrency(maxLoan, { compact: true })} max
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-[#F2F2F7] text-[12px]">
            <div className="text-[11px] text-[#AEAEB2] uppercase tracking-wider mb-1">Key Ratios</div>
            <div className="text-[#6C6C70] space-y-1">
              <div>• Most banks require DSCR ≥ 1.25x</div>
              <div>• Life companies often require 1.30x+</div>
              <div>• Debt yield &gt; 8% signals conservative underwriting</div>
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          <button className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#F2F2F7] border border-black/[0.06] text-[12px] font-medium hover:bg-black/[0.06] transition-colors">
            <Save className="w-3.5 h-3.5" />
            Save Deal
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

// ─── Tab 3: SBA 7(a) / 504 ────────────────────────────────────────────────────

function SBATab() {
  const [projectCost, setProjectCost] = useState('1200000');
  const [realEstatePct, setRealEstatePct] = useState('65');
  const [businessRevenue, setBusinessRevenue] = useState('3500000');
  const [existingDebt, setExistingDebt] = useState('450000');

  const result = useMemo(() =>
    calculateSBA({
      projectCost: parseFloat(projectCost) || 0,
      realEstatePct: parseFloat(realEstatePct) || 0,
      businessRevenue: parseFloat(businessRevenue) || 0,
      existingDebt: parseFloat(existingDebt) || 0,
    }),
    [projectCost, realEstatePct, businessRevenue, existingDebt]
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      <SectionCard title="Project Details">
        <div className="space-y-3">
          <InputField label="Total Project Cost">
            <DollarInput value={projectCost} onChange={setProjectCost} />
          </InputField>
          <InputField label="Real Estate % of Project">
            <PctInput value={realEstatePct} onChange={setRealEstatePct} />
          </InputField>
          <InputField label="Business Annual Revenue">
            <DollarInput value={businessRevenue} onChange={setBusinessRevenue} />
          </InputField>
          <InputField label="Existing Business Debt">
            <DollarInput value={existingDebt} onChange={setExistingDebt} />
          </InputField>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-6">
          {/* Recommendation badge */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className={cn(
                'px-4 py-1.5 rounded-full text-[13px] font-semibold',
                result.recommendation === '504'
                  ? 'bg-[#007AFF]/10 text-[#007AFF]'
                  : 'bg-[#34C759]/10 text-[#1a7a34]'
              )}
            >
              SBA {result.recommendation === '504' ? '504' : '7(a)'} Recommended
            </div>
          </div>
          <p className="text-[12px] text-[#6C6C70] mb-5">{result.reason}</p>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            <MetricCard label="Eligible Amount" value={formatCurrency(result.eligibleAmount, { compact: true })} color="text-[#007AFF]" />
            <MetricCard label="Required Equity Injection" value={formatCurrency(result.requiredEquity, { compact: true })} />
            <MetricCard label="Est. 10-Year Payment" value={formatCurrency(result.estimated10yrPayment)} sub="7(a) ~10.25%" />
            <MetricCard label="Est. 25-Year Payment" value={formatCurrency(result.estimated25yrPayment)} sub="504 RE portion ~6.75%" />
          </div>

          {/* SBA checklist */}
          <div className="border-t border-black/[0.06] pt-4">
            <div className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider mb-3">
              SBA {result.recommendation === '504' ? '504' : '7(a)'} Requirements Checklist
            </div>
            <div className="space-y-2 text-[12px]">
              {(result.recommendation === '504'
                ? [
                    'Business must be for-profit, meet SBA size standards',
                    'Owner-occupancy ≥ 51% of real estate (existing) or 60% (new construction)',
                    'CDC (Certified Development Company) required as lender',
                    '10% borrower equity injection minimum',
                    '25-year fixed rate for real estate, 10-year for equipment',
                    'No other government debt delinquency',
                  ]
                : [
                    'Business must be for-profit, US-based, meet SBA size standards',
                    '15–20% equity injection required (10% for certain cases)',
                    'Must show inability to obtain conventional financing',
                    'Business plan and financial projections required',
                    'Personal guarantee from 20%+ owners',
                    'Collateral required where available',
                  ]
              ).map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[#007AFF]/40 flex-shrink-0 mt-0.5" />
                  <span className="text-[#6C6C70]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

// ─── Tab 4: Multi-Family Underwriting ─────────────────────────────────────────

function MultiFamilyTab() {
  const [unitType, setUnitType] = useState<'2_4' | '5plus'>('2_4');
  // 2-4 unit
  const [rentalIncome, setRentalIncome] = useState('4800');
  const [loanAmount, setLoanAmount] = useState('480000');
  const [rate, setRate] = useState('7.125');
  const [purchasePrice, setPurchasePrice] = useState('600000');
  // 5+ unit
  const [grossRent5, setGrossRent5] = useState('144000');
  const [vacancy5, setVacancy5] = useState('5');
  const [expenses5, setExpenses5] = useState('48000');
  const [loanAmt5, setLoanAmt5] = useState('900000');
  const [rate5, setRate5] = useState('7.5');

  // 2-4 unit calcs (FNMA guidelines)
  const monthlyPI = calculateMonthlyPayment(
    parseFloat(loanAmount) || 0,
    parseFloat(rate) || 0,
    360
  );
  const monthlyRent = parseFloat(rentalIncome) || 0;
  // FNMA: 75% of rental income counted
  const rentalOffset = monthlyRent * 0.75;
  const ltv = (parseFloat(loanAmount) || 0) / (parseFloat(purchasePrice) || 1) * 100;

  // 5+ unit calcs
  const noi5 = ((parseFloat(grossRent5) || 0) * (1 - (parseFloat(vacancy5) || 0) / 100)) - (parseFloat(expenses5) || 0);
  const annualDebtService5 = calculateMonthlyPayment(parseFloat(loanAmt5) || 0, parseFloat(rate5) || 0, 300) * 12;
  const dscr5 = annualDebtService5 > 0 ? noi5 / annualDebtService5 : 0;

  return (
    <div className="space-y-5">
      {/* Unit type switcher */}
      <div className="flex rounded-xl overflow-hidden border border-black/[0.06] w-fit">
        {([['2_4', '2–4 Unit (Residential)'], ['5plus', '5+ Unit (Commercial)']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setUnitType(val)}
            className={cn(
              'px-4 py-2 text-[12px] font-medium transition-colors',
              unitType === val ? 'bg-[#007AFF] text-white' : 'bg-[#F2F2F7] text-[#6C6C70]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {unitType === '2_4' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
          <SectionCard title="2–4 Unit (FNMA Guidelines)">
            <div className="space-y-3">
              <InputField label="Purchase Price">
                <DollarInput value={purchasePrice} onChange={setPurchasePrice} />
              </InputField>
              <InputField label="Loan Amount">
                <DollarInput value={loanAmount} onChange={setLoanAmount} />
              </InputField>
              <InputField label="Interest Rate">
                <PctInput value={rate} onChange={setRate} />
              </InputField>
              <InputField label="Monthly Rental Income (all units)">
                <DollarInput value={rentalIncome} onChange={setRentalIncome} />
              </InputField>
            </div>
          </SectionCard>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Monthly P&I" value={formatCurrency(monthlyPI)} />
                <MetricCard
                  label="Rental Offset (75% FNMA)"
                  value={formatCurrency(rentalOffset)}
                  color="text-[#34C759]"
                />
                <MetricCard
                  label="Net Housing Expense"
                  value={formatCurrency(Math.max(0, monthlyPI - rentalOffset))}
                />
                <MetricCard
                  label="LTV"
                  value={`${ltv.toFixed(1)}%`}
                  color={ltv <= 80 ? 'text-[#34C759]' : ltv <= 96.5 ? 'text-[#FF9500]' : 'text-[#FF3B30]'}
                />
              </div>
              <div className="mt-4 p-3 rounded-xl bg-[#007AFF]/[0.06] border border-[#007AFF]/20 text-[12px] text-[#007AFF]">
                FNMA uses 75% of rental income to offset PITIA for 2–4 unit primary residence.
                Rental income is eligible if documented with lease agreements or Fannie appraiser rental schedule.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
          <SectionCard title="5+ Unit (Commercial Underwriting)">
            <div className="space-y-3">
              <InputField label="Gross Annual Rent">
                <DollarInput value={grossRent5} onChange={setGrossRent5} />
              </InputField>
              <InputField label="Vacancy Rate">
                <PctInput value={vacancy5} onChange={setVacancy5} />
              </InputField>
              <InputField label="Total Annual Expenses">
                <DollarInput value={expenses5} onChange={setExpenses5} />
              </InputField>
              <InputField label="Loan Amount">
                <DollarInput value={loanAmt5} onChange={setLoanAmt5} />
              </InputField>
              <InputField label="Interest Rate">
                <PctInput value={rate5} onChange={setRate5} />
              </InputField>
            </div>
          </SectionCard>
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm p-5">
              <div className="text-[11px] text-[#AEAEB2] mb-1">Annual NOI</div>
              <div className="text-[48px] font-thin tabular-nums tracking-tight text-[#0F1D2E] mb-4">
                {formatCurrency(noi5)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  label="DSCR"
                  value={dscr5.toFixed(2)}
                  color={dscr5 >= 1.25 ? 'text-[#34C759]' : dscr5 >= 1.0 ? 'text-[#FF9500]' : 'text-[#FF3B30]'}
                />
                <MetricCard label="Annual Debt Service" value={formatCurrency(annualDebtService5, { compact: true })} />
              </div>
            </div>
          </div>
        </div>
      )}
      <Disclaimer />
    </div>
  );
}

// ─── Tab 5: Bridge Loan Tracker ────────────────────────────────────────────────

interface BridgeLoan {
  id: string;
  address: string;
  loanAmount: number;
  maturityDate: string;
  exitStrategy: string;
  status: 'active' | 'extension_requested' | 'paid_off' | 'default';
}

const SAMPLE_BRIDGE_LOANS: BridgeLoan[] = [
  {
    id: '1',
    address: '742 Magnolia Pl, Atlanta GA 30308',
    loanAmount: 1_200_000,
    maturityDate: '2026-08-15',
    exitStrategy: 'Refi to DSCR',
    status: 'active',
  },
  {
    id: '2',
    address: '215 Peachtree St NE, Atlanta GA 30303',
    loanAmount: 850_000,
    maturityDate: '2026-07-01',
    exitStrategy: 'Sell',
    status: 'active',
  },
  {
    id: '3',
    address: '1049 Virginia Ave, Atlanta GA 30306',
    loanAmount: 2_100_000,
    maturityDate: '2026-06-20',
    exitStrategy: 'Conventional Refi',
    status: 'extension_requested',
  },
];

function daysToMaturity(dateStr: string): number {
  const now = new Date();
  const mat = new Date(dateStr);
  return Math.ceil((mat.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function BridgeTrackerTab() {
  const [loans, setLoans] = useState<BridgeLoan[]>(SAMPLE_BRIDGE_LOANS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAddress, setNewAddress] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newMaturity, setNewMaturity] = useState('');
  const [newExit, setNewExit] = useState('Sell');

  const STATUS_BADGE: Record<BridgeLoan['status'], string> = {
    active: 'bg-[#34C759]/10 text-[#1a7a34]',
    extension_requested: 'bg-[#FF9500]/10 text-[#9a5700]',
    paid_off: 'bg-[#F2F2F7] text-[#AEAEB2]',
    default: 'bg-[#FF3B30]/10 text-[#9a1f18]',
  };
  const STATUS_LABELS: Record<BridgeLoan['status'], string> = {
    active: 'Active',
    extension_requested: 'Extension Requested',
    paid_off: 'Paid Off',
    default: 'Default',
  };

  function addLoan() {
    if (!newAddress || !newAmount || !newMaturity) return;
    setLoans((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        address: newAddress,
        loanAmount: parseFloat(newAmount) || 0,
        maturityDate: newMaturity,
        exitStrategy: newExit,
        status: 'active',
      },
    ]);
    setShowAddModal(false);
    setNewAddress('');
    setNewAmount('');
    setNewMaturity('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-[#AEAEB2]">{loans.length} active bridge loans</div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#007AFF] text-[12px] font-medium text-white hover:bg-[#007AFF]/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Bridge Loan
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-black/[0.06]">
              {['Property', 'Loan Amount', 'Maturity Date', 'Days Left', 'Exit Strategy', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => {
              const days = daysToMaturity(loan.maturityDate);
              const daysColor =
                days < 30
                  ? 'text-[#FF3B30] font-semibold'
                  : days < 90
                  ? 'text-[#FF9500] font-semibold'
                  : 'text-[#0F1D2E]';
              return (
                <tr key={loan.id} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.02] transition-colors">
                  <td className="px-4 py-3 text-[12px] font-medium text-[#0F1D2E]">{loan.address}</td>
                  <td className="px-4 py-3 text-[12px] tabular-nums font-medium text-[#0F1D2E]">
                    {formatCurrency(loan.loanAmount, { compact: true })}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#6C6C70]">
                    {new Date(loan.maturityDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className={cn('px-4 py-3 text-[12px] tabular-nums', daysColor)}>
                    {days > 0 ? `${days}d` : 'Matured'}
                    {days < 90 && days > 0 && (
                      <AlertTriangle className="w-3 h-3 inline ml-1 mb-0.5" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#6C6C70]">{loan.exitStrategy}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', STATUS_BADGE[loan.status])}>
                      {STATUS_LABELS[loan.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-black/[0.06] shadow-card-xl w-full max-w-md p-6">
            <h3 className="text-[15px] font-semibold text-[#0F1D2E] mb-4">Add Bridge Loan</h3>
            <div className="space-y-4">
              <InputField label="Property Address">
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className={INPUT_CLS}
                  placeholder="123 Main St, Atlanta GA 30308"
                />
              </InputField>
              <InputField label="Loan Amount">
                <DollarInput value={newAmount} onChange={setNewAmount} />
              </InputField>
              <InputField label="Maturity Date">
                <input
                  type="date"
                  value={newMaturity}
                  onChange={(e) => setNewMaturity(e.target.value)}
                  className={INPUT_CLS}
                />
              </InputField>
              <InputField label="Exit Strategy">
                <select
                  value={newExit}
                  onChange={(e) => setNewExit(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option>Sell</option>
                  <option>Refi to DSCR</option>
                  <option>Conventional Refi</option>
                  <option>SBA Refi</option>
                  <option>Other</option>
                </select>
              </InputField>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 h-9 rounded-xl bg-[#F2F2F7] text-[13px] font-medium text-[#0F1D2E] hover:bg-black/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addLoan}
                className="flex-1 h-9 rounded-xl bg-[#007AFF] text-[13px] font-medium text-white hover:bg-[#007AFF]/90 transition-colors"
              >
                Add Loan
              </button>
            </div>
          </div>
        </div>
      )}
      <Disclaimer />
    </div>
  );
}

// ─── Main Commercial Page ─────────────────────────────────────────────────────

const TABS = [
  { id: 'noi', label: 'NOI & Cap Rate' },
  { id: 'dscr', label: 'Commercial DSCR' },
  { id: 'sba', label: 'SBA 7(a) / 504' },
  { id: 'multifamily', label: 'Multi-Family' },
  { id: 'bridge', label: 'Bridge Tracker' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function CommercialClient() {
  const [activeTab, setActiveTab] = useState<TabId>('noi');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-[#007AFF]" />
          <h1 className="text-2xl font-semibold text-[#0F1D2E] tracking-tight">Commercial</h1>
        </div>
        <p className="text-[#AEAEB2] text-sm">
          Commercial deal analysis — NOI, DSCR, SBA, multi-family underwriting, and bridge tracking.
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

      {activeTab === 'noi' && <NOITab />}
      {activeTab === 'dscr' && <CommercialDSCRTab />}
      {activeTab === 'sba' && <SBATab />}
      {activeTab === 'multifamily' && <MultiFamilyTab />}
      {activeTab === 'bridge' && <BridgeTrackerTab />}
    </div>
  );
}
