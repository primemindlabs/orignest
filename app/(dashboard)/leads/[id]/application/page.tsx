import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Smart1003Form } from './Smart1003Form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Application (1003)' };

export default async function ApplicationPage({ params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, loan_type, loan_purpose, loan_amount, property_type, occupancy_type, property_address, credit_score, stage')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!lead) notFound();

  // Load or create the draft application.
  let { data: app } = await sb
    .from('loan_applications')
    .select('status, loan_data, property_data, borrower_data, employment_data, declarations_data')
    .eq('lead_id', params.id)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!app) {
    const { data: created } = await sb
      .from('loan_applications')
      .insert({ org_id: orgId, lead_id: params.id, application_type: 'residential' })
      .select('status, loan_data, property_data, borrower_data, employment_data, declarations_data')
      .single();
    app = created;
  }

  // Merge saved section data into one flat value map; seed from the lead where a
  // section value isn't set yet (occupancy/property_type vocab differs — only seed
  // values the 1003 form's own option set understands).
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
    ...sectionData, // saved values always win over lead seeds
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href={`/leads/${lead.id}`}
          className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          {lead.first_name} {lead.last_name}
        </Link>
        <h1 className="text-[22px] font-bold text-black tracking-tight mt-2">Application (1003)</h1>
        <p className="text-label-2 text-sm mt-0.5">
          Smart form — fields appear only as they become relevant. SSN/DOB are collected separately
          and never stored in plain text.
        </p>
      </div>

      <Smart1003Form
        leadId={lead.id}
        initialValues={seeded}
        initialStatus={app?.status ?? 'draft'}
      />
    </div>
  );
}
