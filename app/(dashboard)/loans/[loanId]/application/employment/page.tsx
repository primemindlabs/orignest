import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import type { Application, EmploymentType } from '@/types/apply';

export const dynamic = 'force-dynamic';

const EMP_TYPE_LABELS: Record<EmploymentType, { label: string; description: string }> = {
  employed: { label: 'Employed', description: 'W-2 employee' },
  self_employed: { label: 'Self-Employed', description: 'Business owner / contractor' },
  retired: { label: 'Retired', description: 'Pension or Social Security' },
  other: { label: 'Other', description: 'VA disability, rental, etc.' },
};

function money(v: number | null | undefined): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-[var(--c-border)] last:border-0">
      <span className="text-[13px] text-[var(--c-label2)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--c-text)] text-right">{value}</span>
    </div>
  );
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('*')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // Defensive: the applications table / 1003 may not exist for this loan yet.
  let app: Partial<Application> | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select('*')
      .eq('lead_id', params.loanId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    app = (data as Partial<Application> | null) ?? null;
  } catch {
    app = null;
  }

  const empType = app?.employment_type ?? null;
  const hasData = !!app && (empType != null || app.gross_monthly_income != null || app.employer_name != null);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Employment (1003)</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Income and employment details captured from the borrower&apos;s digital 1003 application.
        </p>
      </div>

      {!hasData ? (
        <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center">
          <p className="text-[14px] font-medium text-[var(--c-text)]">No employment information yet</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 mb-4">
            The borrower hasn&apos;t completed the employment section of the 1003 application.
          </p>
          <Link
            href={`/loans/${params.loanId}/apply-1003`}
            className="inline-flex items-center rounded-md bg-[var(--c-gold-deep)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition"
          >
            Send / start the 1003 application
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Employment type card */}
          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label3)] mb-1">
              Employment Type
            </div>
            {empType ? (
              <>
                <div className="text-[15px] font-semibold text-[var(--c-text)]">
                  {EMP_TYPE_LABELS[empType].label}
                </div>
                <div className="text-[12px] text-[var(--c-label2)]">
                  {EMP_TYPE_LABELS[empType].description}
                </div>
              </>
            ) : (
              <div className="text-[14px] text-[var(--c-label2)]">Not specified</div>
            )}
          </div>

          {/* Detail card, mirrors EmploymentSection field labels */}
          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-label3)] mb-2">
              Details
            </div>

            {empType === 'employed' && (
              <div>
                <Field label="Employer name" value={app?.employer_name || '—'} />
                <Field label="Job title" value={app?.job_title || '—'} />
                <Field
                  label="Years at job"
                  value={app?.years_at_job != null ? String(app.years_at_job) : '—'}
                />
                <Field label="Gross monthly income" value={money(app?.gross_monthly_income)} />
              </div>
            )}

            {empType === 'self_employed' && (
              <div>
                <Field label="Business name" value={app?.self_emp_business_name || '—'} />
                <Field
                  label="Years in business"
                  value={app?.self_emp_years != null ? String(app.self_emp_years) : '—'}
                />
                <Field label="Monthly net income" value={money(app?.self_emp_monthly_net)} />
                <Field label="Gross monthly income" value={money(app?.gross_monthly_income)} />
              </div>
            )}

            {empType === 'retired' && (
              <div>
                <Field label="Monthly retirement income" value={money(app?.monthly_retirement_income)} />
                <Field label="Gross monthly income" value={money(app?.gross_monthly_income)} />
              </div>
            )}

            {empType === 'other' && (
              <div>
                <Field label="Gross monthly income" value={money(app?.gross_monthly_income)} />
              </div>
            )}

            {!empType && (
              <Field label="Gross monthly income" value={money(app?.gross_monthly_income)} />
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[12px] text-[var(--c-label3)]">
              {app?.status ? `Application status: ${app.status.replace(/_/g, ' ')}` : 'From the borrower 1003'}
            </p>
            <Link
              href={`/loans/${params.loanId}/apply-1003`}
              className="text-[12px] font-medium text-[var(--c-gold-deep)] hover:underline"
            >
              View / resend 1003 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
