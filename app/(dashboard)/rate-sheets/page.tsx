import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { RateSheetParser } from '@/components/tools/RateSheetParser';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rate Sheet Parser' };

export default async function RateSheetsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">AI Rate Sheet Parser</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Paste a lender rate sheet to extract pricing + adjusters, then find the best fit for a borrower.
        </p>
      </div>
      <RateSheetParser />
    </div>
  );
}
