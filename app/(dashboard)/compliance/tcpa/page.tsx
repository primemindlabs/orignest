import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { TCPACenter } from '@/components/compliance/TCPACenter';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'TCPA & Communication Center' };

export default async function TCPACenterPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-5xl">
      <TCPACenter />
    </div>
  );
}
