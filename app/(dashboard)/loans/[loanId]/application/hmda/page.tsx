import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Mirrors the option labels in components/apply/sections/HMDASection.tsx
const ETHNICITY_LABELS: Record<string, string> = {
  prefer_not: 'I do not wish to provide this information',
  hispanic_or_latino: 'Hispanic or Latino',
  not_hispanic: 'Not Hispanic or Latino',
};
const RACE_LABELS: Record<string, string> = {
  prefer_not: 'I do not wish to provide this information',
  american_indian: 'American Indian or Alaska Native',
  asian: 'Asian',
  black: 'Black or African American',
  pacific_islander: 'Native Hawaiian or Other Pacific Islander',
  white: 'White',
};
const SEX_LABELS: Record<string, string> = {
  prefer_not: 'I do not wish to provide this information',
  female: 'Female',
  male: 'Male',
};

function labelFor(map: Record<string, string>, value: string | null | undefined): string | null {
  if (!value) return null;
  return map[value] ?? value;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface ApplicationRow {
  status: string | null;
  hmda_race: string | null;
  hmda_ethnicity: string | null;
  hmda_sex: string | null;
  hmda_collected_at: string | null;
  updated_at?: string | null;
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

  // Defensive: the applications table / columns may not exist on every deploy.
  let application: ApplicationRow | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select('status, hmda_race, hmda_ethnicity, hmda_sex, hmda_collected_at, updated_at')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    application = (data as ApplicationRow) ?? null;
  } catch {
    application = null;
  }

  const ethnicity = labelFor(ETHNICITY_LABELS, application?.hmda_ethnicity);
  const race = labelFor(RACE_LABELS, application?.hmda_race);
  const sex = labelFor(SEX_LABELS, application?.hmda_sex);
  const collectedAt = application?.hmda_collected_at ?? null;

  const hasAnyAnswer = Boolean(application?.hmda_race || application?.hmda_ethnicity || application?.hmda_sex);
  const collected = Boolean(collectedAt) || hasAnyAnswer;

  const rows: { label: string; value: string | null }[] = [
    { label: 'Ethnicity', value: ethnicity },
    { label: 'Race', value: race },
    { label: 'Sex', value: sex },
  ];

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">HMDA Data</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Government Monitoring Information collected for Home Mortgage Disclosure Act reporting and fair-lending compliance.
        </p>
      </div>

      {/* Collection status banner */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: collected ? 'var(--c-gold-deep)' : 'var(--c-label3)' }}
          />
          <div>
            <div className="text-[13px] font-semibold text-[var(--c-text)]">
              {collected ? 'GMI / HMDA collected' : 'GMI / HMDA not yet collected'}
            </div>
            <div className="text-[12px] text-[var(--c-label3)]">
              {collected ? `Recorded ${fmtDate(collectedAt)}` : 'No demographic information on file for this loan.'}
            </div>
          </div>
        </div>
        {application?.status ? (
          <span className="text-[11px] uppercase tracking-wide text-[var(--c-label2)] rounded-full border border-[var(--c-border)] px-2.5 py-1">
            {application.status.replace(/_/g, ' ')}
          </span>
        ) : null}
      </div>

      {collected ? (
        <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] divide-y divide-[var(--c-border)]">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] text-[var(--c-label2)]">{r.label}</span>
              <span className="text-[13px] font-medium text-[var(--c-text)] text-right">
                {r.value ?? <span className="text-[var(--c-label3)] font-normal">Not provided</span>}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--c-border)] bg-[var(--c-fill)] px-5 py-8 text-center">
          <div className="text-[14px] font-semibold text-[var(--c-text)]">No HMDA demographics yet</div>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 max-w-md mx-auto">
            Government Monitoring Information is gathered during the digital 1003. Send or complete the
            application to capture the borrower&apos;s ethnicity, race, and sex (or their election not to provide it).
          </p>
          <Link
            href={`/loans/${params.loanId}/apply-1003`}
            className="inline-flex items-center mt-4 rounded-md bg-[var(--c-gold-deep)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Go to 1003 Application
          </Link>
        </div>
      )}

      <p className="text-[11px] text-[var(--c-label3)] leading-relaxed">
        The borrower is not required to furnish this information. A lender may not discriminate on the basis of
        this information or on whether it is furnished. For applications taken in person where the borrower
        declines, the law may require collection by visual observation or surname.
      </p>
    </div>
  );
}
