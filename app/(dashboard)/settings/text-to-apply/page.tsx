import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TextToApplyClient } from './TextToApplyClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Text-to-Apply' };

export default async function TextToApplyPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Settings</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Text-to-Apply</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Let prospects text a keyword to your number and get pre-qualified over SMS — qualified leads land in your pipeline automatically, white-labeled to you.</p>
      </div>
      <TextToApplyClient />
    </div>
  );
}
