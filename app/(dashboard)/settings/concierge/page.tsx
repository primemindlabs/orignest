import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConciergeSettingsClient } from './ConciergeSettingsClient';
import { WebsiteWidgetCard } from './WebsiteWidgetCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ashley Concierge' };

export default async function ConciergeSettingsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Settings</Link>
      <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Ashley Concierge</h1>
      <p className="text-[13px] text-[var(--c-label2)] mt-0.5 mb-5">
        An AI assistant that texts your borrowers on your behalf — qualifies them, answers general questions, books calls, and starts applications. It never quotes rates or makes approval claims, and hands off to you for anything sensitive. Test how it replies on any lead’s page.
      </p>
      <ConciergeSettingsClient />
      <div className="mt-5 max-w-2xl">
        <WebsiteWidgetCard />
      </div>
    </div>
  );
}
