import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ARMResetClient } from './ARMResetClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ARM Reset Watch' };

export default async function ARMWatchPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/my-book" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> My Book</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">ARM Reset Watch</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Catch adjustable-rate resets in your book before they hit — see the projected rate, payment shock, and start a refi in one click.</p>
      </div>
      <ARMResetClient />
    </div>
  );
}
