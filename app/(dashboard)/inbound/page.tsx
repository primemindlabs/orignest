import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { InboundClient, type StagedRow } from './InboundClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Inbound — AshleyIQ' };

export default async function InboundPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data } = await sb
    .from('imported_loans')
    .select('id, source, borrower_first_name, borrower_last_name, borrower_email, borrower_phone, loan_amount, loan_type, loan_purpose, property_address, created_at')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(500);

  return <InboundClient initial={(data ?? []) as StagedRow[]} />;
}
