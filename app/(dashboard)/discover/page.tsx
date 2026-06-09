import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DiscoverClient } from './DiscoverClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Discover Realtors' };

export default async function DiscoverPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <div className="flex items-center gap-2 text-[12px] mb-2">
          <Link href="/realtors" className="text-[var(--c-label2)] hover:text-[var(--c-text)]">My Partners</Link>
          <span className="text-[var(--c-gold-deep)] font-medium">Discover</span>
        </div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Discover Realtors</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Top-producing agents in your market you&apos;re not working with yet — ranked by how well they match your business (geography, price range, volume, buyer focus). Everything Model Match does, built in.
        </p>
      </div>
      <DiscoverClient />
    </div>
  );
}
