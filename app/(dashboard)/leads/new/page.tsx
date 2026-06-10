import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewLeadForm } from './NewLeadForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'New Lead' };

export default async function NewLeadPage({ searchParams }: { searchParams: { type?: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const isApplication = searchParams.type === 'application';

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          Back to leads
        </Link>
        <h1 className="text-[22px] font-bold text-black tracking-tight mt-2">
          {isApplication ? 'New Loan Application' : 'Add Lead'}
        </h1>
        <p className="text-label-2 text-sm mt-0.5">
          {isApplication
            ? 'Starts at the application stage. We’ll check for possible duplicates as you type.'
            : 'We’ll check for possible duplicates as you type.'}
        </p>
      </div>

      <NewLeadForm initialStage={isApplication ? 'application' : 'new_inquiry'} />
    </div>
  );
}
