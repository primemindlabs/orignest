import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface ApplicationRow {
  borrower_first_name: string | null;
  borrower_last_name: string | null;
  borrower_dob: string | null;
  borrower_ssn_last4: string | null;
  borrower_phone: string | null;
  borrower_email: string | null;
  coborrower_first_name: string | null;
  coborrower_last_name: string | null;
  updated_at: string | null;
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return value;
  }
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const shown = value && String(value).trim().length ? value : '—';
  return (
    <div className="space-y-0.5">
      <div className="text-[12px] uppercase tracking-wide text-[var(--c-label3)]">{label}</div>
      <div className="text-[14px] text-[var(--c-text)]">{shown}</div>
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

  let app: ApplicationRow | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select(
        'borrower_first_name, borrower_last_name, borrower_dob, borrower_ssn_last4, borrower_phone, borrower_email, coborrower_first_name, coborrower_last_name, updated_at'
      )
      .eq('lead_id', params.loanId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    app = (data as ApplicationRow | null) ?? null;
  } catch {
    app = null;
  }

  const applyHref = `/loans/${params.loanId}/apply-1003`;
  const ssnMasked = app?.borrower_ssn_last4 ? `•••-••-${app.borrower_ssn_last4}` : '—';
  const fullName = [app?.borrower_first_name, app?.borrower_last_name].filter(Boolean).join(' ').trim();
  const hasCoBorrower = !!(app?.coborrower_first_name || app?.coborrower_last_name);
  const coName = [app?.coborrower_first_name, app?.coborrower_last_name].filter(Boolean).join(' ').trim();

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Borrower (1003)</h1>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
            Identity captured on the loan application. Sensitive fields are masked.
          </p>
        </div>
        <Link
          href={applyHref}
          className="shrink-0 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors"
        >
          Open full 1003
        </Link>
      </div>

      {!app ? (
        <div className="rounded-xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center">
          <div className="text-[15px] font-semibold text-[var(--c-text)]">No application on file yet</div>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--c-label2)]">
            Start or share the smart 1003 to capture the borrower&apos;s identity, employment, and
            assets. The form adapts to this loan&apos;s program.
          </p>
          <Link
            href={applyHref}
            className="mt-4 inline-flex items-center rounded-lg bg-[var(--c-gold-deep)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Start / share the smart 1003
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[15px] font-semibold text-[var(--c-text)]">
                {fullName || 'Borrower'}
              </div>
              {app.updated_at ? (
                <div className="text-[12px] text-[var(--c-label3)]">Updated {fmtDate(app.updated_at)}</div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name" value={app.borrower_first_name} />
              <Field label="Last name" value={app.borrower_last_name} />
              <Field label="Date of birth" value={fmtDate(app.borrower_dob)} />
              <Field label="SSN (last 4)" value={ssnMasked} />
              <Field label="Phone" value={app.borrower_phone} />
              <Field label="Email" value={app.borrower_email} />
            </div>
          </div>

          {hasCoBorrower ? (
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5">
              <div className="mb-4 text-[15px] font-semibold text-[var(--c-text)]">Co-borrower</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name" value={app.coborrower_first_name} />
                <Field label="Last name" value={app.coborrower_last_name} />
              </div>
              <p className="mt-3 text-[12px] text-[var(--c-label3)]">
                {coName ? `${coName} is listed as a co-borrower on this file.` : 'Co-borrower on file.'}
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
