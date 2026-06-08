import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import IncomeClient from './IncomeClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Income Calculators' };

export default async function IncomePage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return <IncomeClient />;
}
