import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { DraftsForReview } from '@/components/team/DraftsForReview';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Drafts for Review' };

export default async function DraftsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Drafts for Review</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Messages your assistant drafted for your approval. Approve to send via your channels, or reject. Assistants see the status of what they submitted here.
        </p>
      </div>
      <DraftsForReview />
    </div>
  );
}
