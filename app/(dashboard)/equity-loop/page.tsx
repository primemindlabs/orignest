import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { EquityLoopClient } from '@/components/post-close/EquityLoopClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Post-Close Equity Loop' };

// Distinct from the existing /post-close "Nurture" page (nurture_sequences). This is
// the Phase 103 Equity Loop: rate-drop + equity-gain review queue over the existing
// borrower_relationships monitor.
export default async function EquityLoopPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return <EquityLoopClient />;
}
