import { auth } from '@clerk/nextjs/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import LendersClient, { type DbLender } from './LendersClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lender Marketplace' };

export default async function LendersPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const supabase = createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) redirect('/onboarding');

  const { data: lenders } = await supabase
    .from('lenders')
    .select('*')
    .eq('org_id', org.id)
    .order('is_preferred', { ascending: false })
    .order('name');

  return <LendersClient orgLenders={(lenders ?? []) as DbLender[]} />;
}