import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import LendersClient, { type DbLender } from './LendersClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lender Marketplace' };

export default async function LendersPage() {
  // getOrgContext().orgId is already the Supabase org UUID — query lenders
  // directly by org_id. (The previous clerk_org_id re-lookup never matched and
  // bounced the page to /onboarding.)
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const supabase = createAdminClient();

  const { data: lenders } = await supabase
    .from('lenders')
    .select('*')
    .eq('org_id', orgId)
    .order('is_preferred', { ascending: false })
    .order('name');

  return <LendersClient orgLenders={(lenders ?? []) as DbLender[]} />;
}