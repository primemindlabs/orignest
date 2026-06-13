import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ImportWizard } from './ImportWizard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Import your pipeline' };

export default async function ImportLeadsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Bring your book</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Import your existing pipeline from a CSV — your contacts come with you. We&rsquo;ll match the columns and skip anyone already here.</p>
      </div>
      <ImportWizard />
    </div>
  );
}
