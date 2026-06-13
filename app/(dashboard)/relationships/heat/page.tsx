import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BorrowerHeatGrid } from '@/components/crm/BorrowerHeatGrid';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Borrower Heat' };

export default async function BorrowerHeatPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Borrower Heat</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Relationship warmth across your book — reach out to cooling borrowers before they go cold.
        </p>
      </div>
      <BorrowerHeatGrid />
    </div>
  );
}
