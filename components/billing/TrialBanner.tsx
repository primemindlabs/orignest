'use client';

/** Phase 35.9 — trial countdown banner. Renders only during an active trial. */
import Link from 'next/link';
import { usePlan } from '@/lib/billing/usePlan';

export function TrialBanner() {
  const { status, daysRemaining, isLoading } = usePlan();
  if (isLoading || status !== 'trialing') return null;

  const days = daysRemaining ?? 14;
  const urgent = days <= 3;

  return (
    <div className={`w-full text-center text-[13px] py-2 px-4 ${urgent ? 'bg-[var(--c-danger)] text-white' : 'bg-[var(--c-gold-light)] text-[var(--c-text)]'}`}>
      {urgent
        ? `⚠️ Your trial ends in ${days} day${days === 1 ? '' : 's'}.`
        : days <= 0
        ? 'Your free trial has ended.'
        : `You have ${days} day${days === 1 ? '' : 's'} left in your free trial.`}{' '}
      <Link href="/settings/billing" className="font-semibold underline hover:no-underline">Add payment method →</Link>
    </div>
  );
}
