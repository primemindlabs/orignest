import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ContentStudioClient } from './ContentStudioClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Content Studio' };

export default async function ContentStudioPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/social" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Social</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">AI Content Studio</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Generate value-first post ideas and LinkedIn connection notes — white-labeled to you, with a built-in guard against rate/APR claims. Copy into your scheduler when ready.</p>
      </div>
      <ContentStudioClient />
    </div>
  );
}
