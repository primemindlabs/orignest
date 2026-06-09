import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AskAshley } from './AskAshley';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ask Ashley' };

export default async function AskAshleyPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/training" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3">
          <ArrowLeft size={14} /> Training
        </Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Ask Ashley</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Your expert mortgage guideline assistant — FNMA, FHLMC, FHA, VA, USDA. Always verify against current published guides.
        </p>
      </div>
      <AskAshley />
    </div>
  );
}
