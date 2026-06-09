import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getOnboardingStatus } from '@/lib/onboarding/status';
import { GettingStartedClient } from './GettingStartedClient';
import { CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Getting Started' };

export default async function GettingStartedPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const status = await getOnboardingStatus(orgId, userId);

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Getting Started</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          A few quick steps to get the most out of Ashley IQ. Each one takes about a minute.
        </p>
      </div>

      {status.allDone ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
          <CheckCircle2 size={28} className="text-green mx-auto mb-2" />
          <p className="text-[15px] font-semibold text-[var(--c-text)]">You&apos;re all set up!</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Everything&apos;s configured. Head to your pipeline and start closing.</p>
        </div>
      ) : (
        <GettingStartedClient initial={status.steps} completedCount={status.completedCount} total={status.total} />
      )}
    </div>
  );
}
