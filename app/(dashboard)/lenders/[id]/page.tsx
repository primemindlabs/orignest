import { auth } from '@clerk/nextjs/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import LenderDetailClient from './LenderDetailClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lender Profile' };

export default async function LenderDetailPage({
  params,
}: {
  params: { id: string };
}) {
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

  const [{ data: lender }, { data: products }, { data: commLog }] =
    await Promise.all([
      supabase
        .from('lenders')
        .select('*')
        .eq('id', params.id)
        .eq('org_id', org.id)
        .maybeSingle(),
      supabase
        .from('lender_products')
        .select('*')
        .eq('lender_id', params.id)
        .eq('org_id', org.id)
        .eq('active', true)
        .order('loan_type'),
      supabase
        .from('lender_comm_log')
        .select('*, profiles(full_name)')
        .eq('lender_id', params.id)
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  if (!lender) notFound();

  return (
    <LenderDetailClient
      lender={lender}
      products={products ?? []}
      commLog={commLog ?? []}
      orgId={org.id}
    />
  );
}