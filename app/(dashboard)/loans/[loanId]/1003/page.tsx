import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { Smart1003Form } from '@/app/(dashboard)/leads/[id]/application/Smart1003Form';

export const dynamic = 'force-dynamic';

// The loan-file 1003 reuses the smart conditional form (Phase 18), now living
// inside the file-within-a-file shell. The contextual sidebar provides section
// navigation; this renders the unified adaptive form.
export default async function Loan1003Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, loan_type, loan_purpose, loan_amount, property_address, credit_score')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  let { data: app } = await sb
    .from('loan_applications')
    .select('status, loan_data, property_data, borrower_data, employment_data, declarations_data')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app) {
    const { data: created } = await sb
      .from('loan_applications')
      .insert({ org_id: orgId, lead_id: params.loanId, application_type: 'residential' })
      .select('status, loan_data, property_data, borrower_data, employment_data, declarations_data')
      .single();
    app = created;
  }

  const sectionData = app
    ? {
        ...(app.loan_data as Record<string, unknown>),
        ...(app.property_data as Record<string, unknown>),
        ...(app.borrower_data as Record<string, unknown>),
        ...(app.employment_data as Record<string, unknown>),
        ...(app.declarations_data as Record<string, unknown>),
      }
    : {};

  const seeded: Record<string, unknown> = {
    loan_type: lead.loan_type ?? '',
    loan_purpose: lead.loan_purpose ?? '',
    loan_amount: lead.loan_amount ?? '',
    property_address: lead.property_address ?? '',
    credit_score: lead.credit_score ?? '',
    ...sectionData,
  };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Application (1003)</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Fields appear only as they become relevant. SSN/DOB are collected separately and never stored in plain text.
        </p>
      </div>
      <Smart1003Form leadId={lead.id} initialValues={seeded} initialStatus={app?.status ?? 'draft'} />
    </div>
  );
}
