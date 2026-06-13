'use client';

import { useState } from 'react';
import { CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

type LoanPurpose = 'purchase' | 'refinance' | 'cash_out_refi';
type PropertyType = 'single_family' | 'condo' | 'townhouse' | 'multi_family' | 'manufactured';
type CreditRange = '580-619' | '620-659' | '660-699' | '700-719' | '720-739' | '740-759' | '760+';

const CREDIT_RANGES: CreditRange[] = ['580-619', '620-659', '660-699', '700-719', '720-739', '740-759', '760+'];

interface FormData {
  loanPurpose: LoanPurpose;
  propertyType: PropertyType;
  propertyValue: string;
  downPayment: string;
  creditRange: CreditRange;
  annualIncome: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  tcpaConsent: boolean;
}

const TCPA_TEXT =
  'By submitting this form, I consent to be contacted by a mortgage loan officer via phone, text, or email regarding my loan inquiry. Message and data rates may apply. Reply STOP to opt out of SMS. I agree to the Terms of Service and Privacy Policy.';

function calculateResults(data: FormData) {
  const income = parseFloat(data.annualIncome.replace(/,/g, '')) || 0;
  const down = parseFloat(data.downPayment.replace(/,/g, '')) || 0;
  const monthlyIncome = income / 12;
  const maxPayment = monthlyIncome * 0.28;

  const rateMap: Record<CreditRange, [number, number]> = {
    '580-619': [7.5, 8.25],
    '620-659': [7.125, 7.625],
    '660-699': [6.875, 7.375],
    '700-719': [6.75, 7.0],
    '720-739': [6.625, 6.875],
    '740-759': [6.5, 6.75],
    '760+': [6.375, 6.625],
  };

  const [rateMin, rateMax] = rateMap[data.creditRange];
  const midRate = (rateMin + rateMax) / 2;
  const r = midRate / 100 / 12;
  const maxLoan = r > 0
    ? (maxPayment / (r * Math.pow(1 + r, 360))) * (Math.pow(1 + r, 360) - 1)
    : maxPayment * 360;
  const payment = r > 0
    ? (maxLoan * r * Math.pow(1 + r, 360)) / (Math.pow(1 + r, 360) - 1)
    : maxLoan / 360;

  const creditMid: Record<CreditRange, number> = {
    '580-619': 599, '620-659': 639, '660-699': 679,
    '700-719': 709, '720-739': 729, '740-759': 749, '760+': 775,
  };
  const credit = creditMid[data.creditRange];
  const program = credit < 620 ? 'FHA' : credit >= 720 ? 'Conventional' : 'FHA';

  return {
    maxLoan: Math.round(maxLoan / 1000) * 1000,
    rateMin,
    rateMax,
    payment: Math.round(payment),
    program,
  };
}

export default function WidgetPage() {
  const params = useParams();
  const token = params.token as string;
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<FormData>({
    loanPurpose: 'purchase',
    propertyType: 'single_family',
    propertyValue: '',
    downPayment: '',
    creditRange: '720-739',
    annualIncome: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    tcpaConsent: false,
  });

  function update(key: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const totalSteps = 6;

  function canNext(): boolean {
    switch (step) {
      case 1: return !!form.loanPurpose;
      case 2: return !!form.propertyType;
      case 3: return form.loanPurpose === 'refinance' ? !!form.propertyValue : !!form.downPayment;
      case 4: return !!form.creditRange;
      case 5: return !!form.annualIncome;
      case 6: return !!form.firstName && !!form.lastName && !!form.email && !!form.phone;
      default: return false;
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/widget/${token}/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          loanPurpose: form.loanPurpose,
          propertyType: form.propertyType,
          propertyValue: parseFloat(form.propertyValue.replace(/,/g, '')) || undefined,
          downPayment: parseFloat(form.downPayment.replace(/,/g, '')) || undefined,
          creditScoreRange: form.creditRange,
          annualIncome: parseFloat(form.annualIncome.replace(/,/g, '')) || undefined,
          tcpaConsent: form.tcpaConsent,
          tcpaConsentText: TCPA_TEXT,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  const results = submitted ? calculateResults(form) : null;

  if (submitted && results) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] bg-white rounded-[14px] shadow-xl p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-green/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-green" />
          </div>
          <h2 className="text-xl font-bold text-label mb-2">You&apos;re Pre-Qualified!</h2>
          <p className="text-sm text-label-2 mb-5">Hi {form.firstName}, here are your estimated numbers:</p>

          <div className="space-y-3 text-left mb-5">
            <div className="flex justify-between py-2.5 border-b border-black/[0.06]">
              <span className="text-sm text-label-2">Max Loan Amount</span>
              <span className="text-sm font-bold text-navy">${results.maxLoan.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-black/[0.06]">
              <span className="text-sm text-label-2">Estimated Rate Range</span>
              <span className="text-sm font-semibold text-label">{results.rateMin}% – {results.rateMax}%</span>
            </div>
            <div className="flex justify-between py-2.5 border-b border-black/[0.06]">
              <span className="text-sm text-label-2">Est. Monthly Payment</span>
              <span className="text-sm font-semibold text-label">${results.payment.toLocaleString()}/mo</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-sm text-label-2">Recommended Program</span>
              <span className="text-sm font-bold text-blue">{results.program}</span>
            </div>
          </div>

          <div className="bg-navy/[0.06] rounded-[10px] p-3 mb-4">
            <p className="text-xs text-navy font-semibold mb-0.5">What happens next?</p>
            <p className="text-xs text-label-2">A licensed loan officer will contact you within 5 minutes to discuss your options and answer any questions.</p>
          </div>

          <p className="text-[10px] text-label-3">Estimates are for informational purposes only and do not constitute a commitment to lend. Actual rates and terms may vary.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-white rounded-[14px] shadow-xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1.5 bg-black/[0.06]">
          <div
            className="h-full bg-navy transition-all duration-300"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Step header */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs text-label-3">Step {step} of {totalSteps}</p>
            <p className="text-xs font-semibold text-label-2">{Math.round((step / totalSteps) * 100)}% complete</p>
          </div>

          {/* Step 1: Loan Purpose */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-bold text-label mb-1">What are you looking to do?</h2>
              <p className="text-sm text-label-2 mb-4">Select your loan purpose</p>
              <div className="space-y-2.5">
                {[
                  { value: 'purchase', label: 'Purchase a Home', sub: 'Buy a new property' },
                  { value: 'refinance', label: 'Refinance', sub: 'Lower my rate or payment' },
                  { value: 'cash_out_refi', label: 'Cash-Out Refinance', sub: 'Access my home equity' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update('loanPurpose', opt.value)}
                    className={cn(
                      'w-full text-left p-4 rounded-[10px] border-2 transition-colors',
                      form.loanPurpose === opt.value
                        ? 'border-navy bg-navy/[0.06]'
                        : 'border-black/[0.10] hover:border-black/[0.20]',
                    )}
                  >
                    <p className="text-sm font-semibold text-label">{opt.label}</p>
                    <p className="text-xs text-label-3">{opt.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Property type */}
          {step === 2 && (
            <div>
              <h2 className="text-lg font-bold text-label mb-1">Property Type</h2>
              <p className="text-sm text-label-2 mb-4">What type of property?</p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { value: 'single_family', label: 'Single Family' },
                  { value: 'condo', label: 'Condo' },
                  { value: 'townhouse', label: 'Townhouse' },
                  { value: 'multi_family', label: 'Multi-Family' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => update('propertyType', opt.value)}
                    className={cn(
                      'p-3 rounded-[10px] border-2 text-sm font-medium transition-colors text-center',
                      form.propertyType === opt.value
                        ? 'border-navy bg-navy/[0.06] text-navy'
                        : 'border-black/[0.10] text-label hover:border-black/[0.20]',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Property value / down payment */}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-bold text-label mb-1">
                {form.loanPurpose === 'purchase' ? 'Down Payment' : 'Property Value'}
              </h2>
              <p className="text-sm text-label-2 mb-4">Estimated amount</p>
              <div className="space-y-3">
                {form.loanPurpose !== 'refinance' ? null : (
                  <div>
                    <label className="block text-xs font-medium text-label-2 mb-1">Estimated Property Value</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3">$</span>
                      <input type="text" value={form.propertyValue} onChange={(e) => update('propertyValue', e.target.value)} placeholder="400,000" className="w-full pl-7 pr-3 py-3 rounded-[10px] border-2 border-black/[0.10] text-sm focus:outline-none focus:border-navy" />
                    </div>
                  </div>
                )}
                {form.loanPurpose === 'purchase' && (
                  <div>
                    <label className="block text-xs font-medium text-label-2 mb-1">Down Payment</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3">$</span>
                      <input type="text" value={form.downPayment} onChange={(e) => update('downPayment', e.target.value)} placeholder="40,000" className="w-full pl-7 pr-3 py-3 rounded-[10px] border-2 border-black/[0.10] text-sm focus:outline-none focus:border-navy" />
                    </div>
                  </div>
                )}
                {form.loanPurpose === 'cash_out_refi' && (
                  <div>
                    <label className="block text-xs font-medium text-label-2 mb-1">Current Loan Balance</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3">$</span>
                      <input type="text" value={form.downPayment} onChange={(e) => update('downPayment', e.target.value)} placeholder="250,000" className="w-full pl-7 pr-3 py-3 rounded-[10px] border-2 border-black/[0.10] text-sm focus:outline-none focus:border-navy" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Credit score */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-bold text-label mb-1">Credit Score Range</h2>
              <p className="text-sm text-label-2 mb-4">Estimate is fine — this won&apos;t affect your credit</p>
              <div className="space-y-2">
                {CREDIT_RANGES.map((range) => (
                  <button
                    key={range}
                    onClick={() => update('creditRange', range)}
                    className={cn(
                      'w-full py-3 px-4 rounded-[10px] border-2 text-sm font-medium transition-colors text-left flex items-center justify-between',
                      form.creditRange === range
                        ? 'border-navy bg-navy/[0.06] text-navy'
                        : 'border-black/[0.10] text-label hover:border-black/[0.20]',
                    )}
                  >
                    <span>{range}</span>
                    {form.creditRange === range && <CheckCircle size={15} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Income */}
          {step === 5 && (
            <div>
              <h2 className="text-lg font-bold text-label mb-1">Annual Income</h2>
              <p className="text-sm text-label-2 mb-4">Household gross income before taxes</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-label-3 text-sm">$</span>
                <input
                  type="text"
                  value={form.annualIncome}
                  onChange={(e) => update('annualIncome', e.target.value)}
                  placeholder="120,000"
                  className="w-full pl-7 pr-3 py-3 rounded-[10px] border-2 border-black/[0.10] text-sm focus:outline-none focus:border-navy"
                />
              </div>
            </div>
          )}

          {/* Step 6: Contact info */}
          {step === 6 && (
            <div>
              <h2 className="text-lg font-bold text-label mb-1">Contact Information</h2>
              <p className="text-sm text-label-2 mb-4">A loan officer will contact you within 5 minutes</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-label-2 mb-1">First Name</label>
                    <input type="text" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] border-2 border-black/[0.10] text-sm focus:outline-none focus:border-navy" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-label-2 mb-1">Last Name</label>
                    <input type="text" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] border-2 border-black/[0.10] text-sm focus:outline-none focus:border-navy" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-label-2 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] border-2 border-black/[0.10] text-sm focus:outline-none focus:border-navy" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-label-2 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} className="w-full px-3 py-2.5 rounded-[10px] border-2 border-black/[0.10] text-sm focus:outline-none focus:border-navy" />
                </div>
                {/* TCPA Consent */}
                <div className="bg-[#F2F2F7] rounded-[10px] p-3">
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.tcpaConsent}
                      onChange={(e) => update('tcpaConsent', e.target.checked)}
                      className="mt-0.5 flex-shrink-0"
                    />
                    <span className="text-[10px] text-label-3 leading-relaxed">{TCPA_TEXT}</span>
                  </label>
                </div>
                {error && <p className="text-xs text-red">{error}</p>}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 mt-6">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="w-10 h-11 rounded-[10px] bg-black/[0.06] flex items-center justify-center text-label-2 hover:bg-black/[0.10] transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {step < totalSteps ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className={cn(
                  'flex-1 py-3 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
                  canNext() ? 'bg-navy text-white hover:bg-navy/90' : 'bg-black/[0.06] text-label-3 cursor-not-allowed',
                )}
              >
                Continue
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canNext() || submitting}
                className={cn(
                  'flex-1 py-3 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-2 transition-colors',
                  canNext() && !submitting ? 'bg-navy text-white hover:bg-navy/90' : 'bg-black/[0.06] text-label-3 cursor-not-allowed',
                )}
              >
                {submitting ? 'Submitting...' : 'Get My Pre-Qual'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
