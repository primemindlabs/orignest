import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { HOIClient, type HoiRecord } from './HOIClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Homeowners Insurance' };

export default async function InsurancePage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  let verifications: HoiRecord[] = [];
  try {
    const { data } = await sb
      .from('hoi_verifications')
      .select('id, carrier_name, policy_number, agent_name, agent_phone, agent_email, dwelling_coverage_amount, liability_coverage_amount, deductible_amount, effective_date, expiration_date, status, coverage_adequate, notes, verified_at, created_at')
      .eq('org_id', orgId).eq('loan_id', loanId)
      .order('created_at', { ascending: false });
    verifications = (data ?? []) as HoiRecord[];
  } catch {
    verifications = []; // migration may not be applied yet
  }

  const { data: lead } = await sb.from('leads').select('loan_amount, property_address, property_city, property_state, property_zip').eq('id', loanId).eq('org_id', orgId).maybeSingle();

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--c-text)]">Homeowners Insurance</h1>
        <p className="text-sm text-[var(--c-label2)] mt-0.5">Record and verify the HOI policy for this loan. Dwelling coverage must meet or exceed the loan amount before closing.</p>
      </div>
      <HOIClient loanId={loanId} verifications={verifications} loanAmount={lead?.loan_amount != null ? Number(lead.loan_amount) : null} propertyAddress={[lead?.property_address, lead?.property_city, lead?.property_state, lead?.property_zip].filter(Boolean).join(', ')} />
    </div>
  );
}
