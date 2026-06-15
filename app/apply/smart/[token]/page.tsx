/**
 * Phase 137 — public adaptive Smart-1003, token-gated. Reuses the in-app
 * Smart1003Form engine (loan-type conditional fields) but saves through the
 * public token route. The token (loan_applications.application_token) is the
 * sole credential; the page is noindex.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Smart1003Form } from '@/app/(dashboard)/leads/[id]/application/Smart1003Form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your application', robots: 'noindex' };

export default async function PublicSmart1003Page({ params }: { params: { token: string } }) {
  const sb = createAdminClient();

  const { data: app } = await sb
    .from('loan_applications')
    .select('id, org_id, lead_id, status, loan_data, property_data, borrower_data, employment_data, declarations_data')
    .eq('application_token', params.token)
    .maybeSingle();
  if (!app) notFound();

  const [{ data: lead }, { data: org }] = await Promise.all([
    sb.from('leads').select('first_name, last_name, loan_type, loan_purpose, loan_amount, property_address, credit_score, assigned_to').eq('id', app.lead_id).maybeSingle(),
    sb.from('organizations').select('name, brand_color').eq('id', app.org_id).maybeSingle(),
  ]);

  const loName = lead?.assigned_to
    ? (await sb.from('profiles').select('first_name, last_name, nmls_id').eq('id', lead.assigned_to).maybeSingle()).data
    : null;

  // Merge saved section data; seed from the lead where not yet set (saved wins).
  const sectionData = {
    ...(app.loan_data as Record<string, unknown>),
    ...(app.property_data as Record<string, unknown>),
    ...(app.borrower_data as Record<string, unknown>),
    ...(app.employment_data as Record<string, unknown>),
    ...(app.declarations_data as Record<string, unknown>),
  };
  const seeded: Record<string, unknown> = {
    loan_type: lead?.loan_type ?? '',
    loan_purpose: lead?.loan_purpose ?? '',
    loan_amount: lead?.loan_amount ?? '',
    property_address: lead?.property_address ?? '',
    credit_score: lead?.credit_score ?? '',
    ...sectionData,
  };

  const brand = org?.brand_color ?? '#C9A95C';
  const officer = loName ? `${loName.first_name ?? ''} ${loName.last_name ?? ''}`.trim() : null;

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8' }}>
      <div style={{ background: '#0F1D2E', borderTop: `3px solid ${brand}`, padding: '20px 16px', color: '#fff' }}>
        <div style={{ maxWidth: 768, margin: '0 auto' }}>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{org?.name ?? 'Your application'}</p>
          <p style={{ fontSize: 12.5, color: '#9fb0c0' }}>
            Digital 1003{officer ? ` · with ${officer}` : ''}{loName?.nmls_id ? ` · NMLS #${loName.nmls_id}` : ''}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 768, margin: '0 auto', padding: '20px 16px 60px' }}>
        <p className="text-label-2 text-sm mb-4">
          This smart form only asks what your loan needs. You can save and finish later — your progress is kept.
        </p>
        <Smart1003Form
          leadId={app.lead_id}
          initialValues={seeded}
          initialStatus={app.status ?? 'draft'}
          saveUrl={`/api/apply/smart/${params.token}`}
          publicMode
        />
        <p style={{ fontSize: 10, color: '#6B7B8D', lineHeight: 1.5, marginTop: 24 }}>
          This is not a commitment to lend or an offer of credit. Equal Housing Opportunity.
          {org?.name ? ` ${org.name}.` : ''} Your Social Security number is collected separately and never stored in plain text.
        </p>
      </div>
    </div>
  );
}
