import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type AppRow = {
  id: string;
  token: string | null;
  status: string | null;
  co_borrower: boolean | null;
  coborrower_first_name: string | null;
  coborrower_last_name: string | null;
  coborrower_dob: string | null;
  coborrower_ssn_last4: string | null;
  coborrower_phone: string | null;
  coborrower_email: string | null;
  updated_at: string | null;
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value && String(value).trim().length > 0 ? value : '—';
  const empty = display === '—';
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-[var(--c-border)] last:border-0">
      <span className="text-[13px] text-[var(--c-label2)]">{label}</span>
      <span className={`text-[13px] font-medium text-right ${empty ? 'text-[var(--c-label3)]' : 'text-[var(--c-text)]'}`}>
        {display}
      </span>
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

  // The 1003 lives in the `applications` table (Phase 105). Pull the latest one
  // for this loan. Be defensive: the table/columns may not exist on every env.
  let app: AppRow | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select(
        'id, token, status, co_borrower, coborrower_first_name, coborrower_last_name, coborrower_dob, coborrower_ssn_last4, coborrower_phone, coborrower_email, updated_at',
      )
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    app = (data as AppRow | null) ?? null;
  } catch {
    app = null;
  }

  const hasName = Boolean(app?.coborrower_first_name || app?.coborrower_last_name);
  const hasContact = Boolean(app?.coborrower_email || app?.coborrower_phone);
  const hasCoBorrower = Boolean(app?.co_borrower) || hasName || hasContact;

  const applyHref = `/loans/${params.loanId}/apply-1003`;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Co-Borrower (1003)</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Co-borrower identity from the digital application. Edit on the 1003 form.
        </p>
      </div>

      {!hasCoBorrower ? (
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--c-fill)]">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--c-label2)"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="text-[14px] font-semibold text-[var(--c-text)]">No co-borrower on this file</p>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-[var(--c-label2)]">
            This loan was submitted with a single borrower. Add a co-borrower in the 1003 application to
            populate this section.
          </p>
          <Link
            href={applyHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-border)] bg-[var(--c-fill)] px-3.5 py-2 text-[13px] font-semibold text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface)]"
          >
            Open 1003
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-[var(--c-text)]">Co-Borrower Identity</h2>
              {app?.status ? (
                <span className="rounded-full bg-[var(--c-fill)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-[var(--c-label2)]">
                  {app.status.replace(/_/g, ' ')}
                </span>
              ) : null}
            </div>
            <Field label="First name" value={app?.coborrower_first_name} />
            <Field label="Last name" value={app?.coborrower_last_name} />
            <Field label="Date of birth" value={fmtDate(app?.coborrower_dob)} />
            <Field
              label="SSN (last 4)"
              value={app?.coborrower_ssn_last4 ? `••• •• ${app.coborrower_ssn_last4}` : null}
            />
            <Field label="Phone" value={app?.coborrower_phone} />
            <Field label="Email" value={app?.coborrower_email} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-3">
            <p className="text-[12px] text-[var(--c-label2)]">Last updated {fmtDate(app?.updated_at)}</p>
            <Link
              href={applyHref}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--c-gold-deep)] hover:underline"
            >
              Edit in 1003
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
