'use client';

import { useState } from 'react';
import { useUser, useOrganization } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    seats: 1,
    badge: null,
    features: [
      '1 loan officer seat',
      'Up to 100 active leads',
      'TRID compliance tracker',
      'TCPA consent management',
      'AI Coach (basic)',
      'Email campaigns',
      'Audit log',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 199,
    seats: 5,
    badge: 'Most popular',
    features: [
      'Up to 5 loan officer seats',
      'Unlimited active leads',
      'TRID + ECOA compliance suite',
      'TCPA consent management',
      'AI Coach (advanced)',
      'Email + SMS campaigns',
      'Pipeline analytics',
      'Branch manager dashboard',
      'Partner network',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: 399,
    seats: 20,
    badge: null,
    features: [
      'Up to 20 loan officer seats',
      'Unlimited active leads',
      'Full compliance suite (TRID, TCPA, GLBA)',
      'AI Coach (premium)',
      'Email + SMS + voice campaigns',
      'Advanced analytics + fair lending',
      'White-label borrower portal',
      'Custom NMLS reporting',
      'Priority support + CSM',
    ],
  },
] as const;

type PlanId = 'starter' | 'growth' | 'team';

interface Step1Data {
  companyName: string;
  nmlsCompanyId: string;
  billingEmail: string;
  teamSize: string;
}

export default function OnboardingPage() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  const [step1, setStep1] = useState<Step1Data>({
    companyName: '',
    nmlsCompanyId: '',
    billingEmail: user?.primaryEmailAddress?.emailAddress ?? '',
    teamSize: '1',
  });
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('growth');

  // If org already exists, go to dashboard
  if (organization) {
    router.replace('/dashboard');
    return null;
  }

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!step1.companyName.trim()) {
      toast.error('Company name is required');
      return;
    }
    setStep(2);
  }

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          companyName: step1.companyName,
          nmlsCompanyId: step1.nmlsCompanyId,
          billingEmail: step1.billingEmail,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to create checkout session');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      {/* Wordmark */}
      <div className="text-[22px] font-bold text-navy tracking-tight mb-8">
        Conduit<span className="text-gold">.</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                step > n
                  ? 'bg-green text-white'
                  : step === n
                  ? 'bg-blue text-white'
                  : 'bg-fill text-label-2'
              }`}
            >
              {step > n ? <Check size={14} /> : n}
            </div>
            {n < 3 && <div className={`w-8 h-0.5 ${step > n ? 'bg-green' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Company details ────────────────────────────────── */}
      {step === 1 && (
        <div className="w-full max-w-md bg-surface rounded-card shadow-card border border-border p-6">
          <h2 className="text-xl font-bold text-black mb-1 tracking-tight">
            Set up your company
          </h2>
          <p className="text-label-2 text-sm mb-6">
            Tell us about your mortgage company. This info appears on your disclosures.
          </p>
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-black block mb-1.5">
                Company Name <span className="text-red">*</span>
              </label>
              <input
                type="text"
                required
                value={step1.companyName}
                onChange={(e) => setStep1((s) => ({ ...s, companyName: e.target.value }))}
                placeholder="Acme Mortgage, LLC"
                className="w-full h-9 px-3 rounded-[10px] border border-border bg-surface text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-black block mb-1.5">
                NMLS Company ID
              </label>
              <input
                type="text"
                value={step1.nmlsCompanyId}
                onChange={(e) => setStep1((s) => ({ ...s, nmlsCompanyId: e.target.value }))}
                placeholder="1234567"
                className="w-full h-9 px-3 rounded-[10px] border border-border bg-surface text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
              />
              <p className="text-xs text-label-3 mt-1">
                Required for TRID disclosures. Find yours at nmlsconsumeraccess.org
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-black block mb-1.5">
                Billing Email <span className="text-red">*</span>
              </label>
              <input
                type="email"
                required
                value={step1.billingEmail}
                onChange={(e) => setStep1((s) => ({ ...s, billingEmail: e.target.value }))}
                placeholder="billing@yourcompany.com"
                className="w-full h-9 px-3 rounded-[10px] border border-border bg-surface text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-black block mb-1.5">
                Team Size
              </label>
              <select
                value={step1.teamSize}
                onChange={(e) => setStep1((s) => ({ ...s, teamSize: e.target.value }))}
                className="w-full h-9 px-3 rounded-[10px] border border-border bg-surface text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
              >
                <option value="1">Just me</option>
                <option value="2-5">2–5 loan officers</option>
                <option value="6-10">6–10 loan officers</option>
                <option value="11-20">11–20 loan officers</option>
                <option value="20+">20+ loan officers</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full h-10 rounded-btn bg-blue text-white text-sm font-semibold hover:bg-blue/90 transition-colors flex items-center justify-center gap-2"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          </form>
        </div>
      )}

      {/* ── Step 2: Plan selection ─────────────────────────────────── */}
      {step === 2 && (
        <div className="w-full max-w-3xl">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-black tracking-tight">Choose your plan</h2>
            <p className="text-label-2 text-sm mt-1">
              14-day free trial on all plans. Cancel anytime.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative text-left bg-surface rounded-card border-2 p-5 transition-all ${
                  selectedPlan === plan.id
                    ? 'border-blue shadow-elevated'
                    : 'border-border hover:border-label-3'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-black">{plan.name}</span>
                  {selectedPlan === plan.id && (
                    <div className="w-5 h-5 rounded-full bg-blue flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </div>
                <div className="mb-3">
                  <span className="text-2xl font-bold text-black metric-value">${plan.price}</span>
                  <span className="text-xs text-label-2">/mo</span>
                  <p className="text-xs text-label-2 mt-0.5">Up to {plan.seats} seat{plan.seats !== 1 ? 's' : ''}</p>
                </div>
                <ul className="space-y-1.5">
                  {plan.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-label-2">
                      <Check size={12} className="text-green flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {plan.features.length > 5 && (
                    <li className="text-xs text-label-3">
                      +{plan.features.length - 5} more features
                    </li>
                  )}
                </ul>
              </button>
            ))}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setStep(1)}
              className="h-10 px-5 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="h-10 px-6 rounded-btn bg-blue text-white text-sm font-semibold hover:bg-blue/90 transition-colors flex items-center gap-2"
            >
              Continue
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="w-full max-w-md bg-surface rounded-card shadow-card border border-border p-6">
          <h2 className="text-xl font-bold text-black mb-1 tracking-tight">
            Start your free trial
          </h2>
          <p className="text-label-2 text-sm mb-5">
            Review your selections and start your 14-day trial. No charge until day 15.
          </p>

          <div className="space-y-3 mb-5">
            <div className="flex justify-between text-sm">
              <span className="text-label-2">Company</span>
              <span className="font-medium text-black">{step1.companyName}</span>
            </div>
            {step1.nmlsCompanyId && (
              <div className="flex justify-between text-sm">
                <span className="text-label-2">NMLS ID</span>
                <span className="font-medium text-black">{step1.nmlsCompanyId}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-label-2">Plan</span>
              <span className="font-medium text-black capitalize">{selectedPlan}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-label-2">Price after trial</span>
              <span className="font-medium text-black">
                ${PLANS.find((p) => p.id === selectedPlan)?.price}/mo
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-label-2">Trial ends</span>
              <span className="font-medium text-black">
                {new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 h-10 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="flex-1 h-10 rounded-btn bg-blue text-white text-sm font-semibold hover:bg-blue/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Redirecting...
                </>
              ) : (
                'Start Free Trial'
              )}
            </button>
          </div>

          <p className="text-xs text-label-3 text-center mt-4">
            You&apos;ll be redirected to Stripe to enter payment info. Your card won&apos;t be
            charged until after the trial period.
          </p>
        </div>
      )}
    </div>
  );
}
