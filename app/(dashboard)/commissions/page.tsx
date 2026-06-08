import { auth } from '@clerk/nextjs/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import CommissionsClient, { type Commission, type Lead, type Profile } from './CommissionsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Commissions' };

export default async function CommissionsPage() {
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

  const [{ data: commissions }, { data: closedLeads }, { data: profiles }] =
    await Promise.all([
      supabase
        .from('commissions')
        .select('*, leads(full_name), profiles(full_name)')
        .eq('org_id', org.id)
        .order('close_date', { ascending: false }),
      supabase
        .from('leads')
        .select('id, full_name, loan_amount, loan_type, stage')
        .eq('org_id', org.id)
        .order('full_name'),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('org_id', org.id)
        .eq('is_active', true)
        .order('full_name'),
    ]);

  // Flatten joins
  const flatCommissions: Commission[] = (commissions ?? []).map((c) => ({
    id: c.id as string,
    lead_id: c.lead_id as string,
    lo_id: c.lo_id as string,
    loan_amount: c.loan_amount as number,
    close_date: c.close_date as string,
    loan_type: c.loan_type as string,
    compensation_type: c.compensation_type as 'lender_paid' | 'borrower_paid',
    compensation_bps: c.compensation_bps as number | null,
    compensation_amount: c.compensation_amount as number,
    referral_fee_amount: c.referral_fee_amount as number,
    net_revenue: c.net_revenue as number | null,
    status: c.status as 'pending' | 'paid' | 'clawed_back',
    payment_date: c.payment_date as string | null,
    notes: c.notes as string | null,
    created_at: c.created_at as string,
    lead_name: (c.leads as { full_name?: string } | null)?.full_name,
    lo_name: (c.profiles as { full_name?: string } | null)?.full_name,
  }));

  return (
    <CommissionsClient
      commissions={flatCommissions}
      leads={(closedLeads ?? []) as Lead[]}
      profiles={(profiles ?? []) as Profile[]}
    />
  );
}