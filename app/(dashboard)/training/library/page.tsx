import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { TrainingLibrary } from '@/components/training/TrainingLibrary';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Training Library' };

export default async function TrainingLibraryPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-6xl">
      <PageHeader title="Training Library" subtitle="Recorded calls, product training, compliance refreshers, and lender guidelines." />
      <TrainingLibrary />
    </div>
  );
}
