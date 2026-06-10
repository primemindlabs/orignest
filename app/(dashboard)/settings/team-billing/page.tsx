import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TeamBillingClient } from './TeamBillingClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Team Billing' };

export default async function TeamBillingPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  if (!['admin', 'branch_manager', 'manager'].includes(role)) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/settings/billing" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Billing</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Team Billing</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Control how seats and call/text usage are billed across your team. Automated platform comms (speed-to-lead, TRID reminders, alerts) are always absorbed by the branch and never count against an LO&apos;s bundle.</p>
      </div>
      <TeamBillingClient />
    </div>
  );
}
