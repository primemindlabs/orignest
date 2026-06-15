import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const fmtMoney = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n));

const fmtEmployment: Record<string, string> = {
  employed: 'W-2 Employed',
  self_employed: 'Self-Employed',
  retired: 'Retired',
  other: 'Other',
};

type AppRow = {
  id: string;
  status: string | null;
  token: string | null;
  updated_at: string | null;
  submitted_at: string | null;
  employment_type: string | null;
  employer_name: string | null;
  job_title: string | null;
  years_at_job: number | null;
  gross_monthly_income: number | null;
  self_emp_business_name: string | null;
  self_emp_years: number | null;
  self_emp_monthly_net: number | null;
  monthly_retirement_income: number | null;
  monthly_debts: number | null;
};

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

  // Most recent application on file for this loan (defensive: table may be empty / not migrated).
  let app: AppRow | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select(
        'id, status, token, updated_at, submitted_at, employment_type, employer_name, job_title, years_at_job, gross_monthly_income, self_emp_business_name, self_emp_years, self_emp_monthly_net, monthly_retirement_income, monthly_debts',
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

  const gross = app?.gross_monthly_income != null ? Number(app.gross_monthly_income) : 0;
  const selfEmp = app?.self_emp_monthly_net != null ? Number(app.self_emp_monthly_net) : 0;
  const retirement = app?.monthly_retirement_income != null ? Number(app.monthly_retirement_income) : 0;
  const debts = app?.monthly_debts != null ? Number(app.monthly_debts) : 0;
  const totalMonthly = gross + selfEmp + retirement;
  const hasAnyIncome = gross > 0 || selfEmp > 0 || retirement > 0;

  const sources: { label: string; amount: number }[] = [
    { label: 'W-2 / base monthly income', amount: gross },
    { label: 'Self-employed net (monthly)', amount: selfEmp },
    { label: 'Retirement income (monthly)', amount: retirement },
  ].filter((s) => s.amount > 0);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Income (1003)</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Income captured on the borrower&apos;s digital application, with the qualifying monthly summary.
        </p>
      </div>

      {!app ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-6 text-center space-y-3">
          <p className="text-[14px] font-semibold text-[var(--c-text)]">No application on file</p>
          <p className="text-[13px] text-[var(--c-label2)] max-w-md mx-auto leading-relaxed">
            Send the borrower a Smart 1003 to collect employment and income, or run the calculators to compute
            qualifying income manually.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Link
              href={`/loans/${params.loanId}/apply-1003`}
              className="inline-flex items-center rounded-[10px] bg-[var(--c-gold-deep)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              Send Smart 1003
            </Link>
            <Link
              href="/income"
              className="inline-flex items-center rounded-[10px] border border-[var(--c-border)] bg-[var(--c-fill)] px-3.5 py-2 text-[13px] font-semibold text-[var(--c-text)] hover:opacity-90"
            >
              Income Calculators
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Monthly qualifying summary */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Total qualifying income / mo</p>
                <p className="text-[30px] font-bold tabular-nums leading-none text-[var(--c-text)] mt-1">
                  {fmtMoney(totalMonthly)}
                </p>
              </div>
              {debts > 0 && (
                <div className="text-right">
                  <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Stated debts / mo</p>
                  <p className="text-[18px] font-semibold tabular-nums text-[var(--c-label2)] mt-1">{fmtMoney(debts)}</p>
                </div>
              )}
            </div>

            {sources.length > 0 ? (
              <div className="mt-4 border-t border-[var(--c-border)] pt-3 space-y-2">
                {sources.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--c-label2)]">{s.label}</span>
                    <span className="font-medium tabular-nums text-[var(--c-text)]">{fmtMoney(s.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-[var(--c-label3)]">
                No income amounts entered yet on the application.
              </p>
            )}
          </div>

          {/* Employment detail */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[14px] font-semibold text-[var(--c-text)]">Employment</p>
              <span className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">
                {app.status ?? 'draft'}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              <Field
                label="Employment type"
                value={app.employment_type ? fmtEmployment[app.employment_type] ?? app.employment_type : '—'}
              />
              <Field label="Employer" value={app.employer_name ?? '—'} />
              <Field label="Job title" value={app.job_title ?? '—'} />
              <Field label="Years at job" value={app.years_at_job != null ? `${Number(app.years_at_job)} yr` : '—'} />
              {(app.self_emp_business_name || app.self_emp_years != null) && (
                <>
                  <Field label="Business name" value={app.self_emp_business_name ?? '—'} />
                  <Field label="Years self-employed" value={app.self_emp_years != null ? `${app.self_emp_years} yr` : '—'} />
                </>
              )}
            </dl>
            {!hasAnyIncome && (
              <p className="mt-3 text-[12px] text-[var(--c-label3)]">
                Income amounts not yet entered. Have the borrower complete the income section of the 1003.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/income"
              className="inline-flex items-center rounded-[10px] border border-[var(--c-border)] bg-[var(--c-fill)] px-3.5 py-2 text-[13px] font-semibold text-[var(--c-text)] hover:opacity-90"
            >
              Open Income Calculators
            </Link>
            <Link
              href={`/loans/${params.loanId}/apply-1003`}
              className="inline-flex items-center rounded-[10px] border border-[var(--c-border)] bg-[var(--c-fill)] px-3.5 py-2 text-[13px] font-semibold text-[var(--c-text)] hover:opacity-90"
            >
              View / resend 1003
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">{label}</dt>
      <dd className="text-[13px] font-medium text-[var(--c-text)] mt-0.5">{value}</dd>
    </div>
  );
}
