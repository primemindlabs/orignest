import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const INCOME_TYPE_LABEL: Record<string, string> = {
  w2_salary: 'W-2 Salary',
  w2_hourly: 'W-2 Hourly',
  self_employed_sole_prop: 'Self-Employed · Sole Prop',
  self_employed_scorp: 'Self-Employed · S-Corp',
  self_employed_partnership: 'Self-Employed · Partnership',
  rental_schedule_e: 'Rental (Schedule E)',
  social_security: 'Social Security',
  pension: 'Pension',
  bonus_commission: 'Bonus / Commission',
  other_employment: 'Other Employment',
};

interface IncomeCalcRow {
  id: string;
  borrower_type: string | null;
  income_type: string | null;
  agency: string | null;
  calculated_income: number | string | null;
  fannie_income: number | string | null;
  freddie_income: number | string | null;
  calculation_notes: string | null;
  created_at: string | null;
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

  // INSERT-only audit table of computed qualifying income (Phase 53). Defensive: may be empty.
  const { data: calcsRaw } = await sb
    .from('income_calculations')
    .select('id, borrower_type, income_type, agency, calculated_income, fannie_income, freddie_income, calculation_notes, created_at')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  const calcs: IncomeCalcRow[] = (calcsRaw ?? []) as IncomeCalcRow[];

  // DTI worksheet may already carry a consolidated monthly income figure.
  const { data: dti } = await sb
    .from('dti_worksheets')
    .select('total_monthly_income')
    .eq('lead_id', params.loanId)
    .maybeSingle();
  const dtiMonthly = dti?.total_monthly_income != null ? Number(dti.total_monthly_income) : null;

  // Keep the latest calc per borrower so re-runs don't double-count.
  const latestPerBorrower = new Map<string, IncomeCalcRow>();
  for (const c of calcs) {
    const key = `${c.borrower_type ?? 'primary'}`;
    if (!latestPerBorrower.has(key)) latestPerBorrower.set(key, c);
  }
  const current = Array.from(latestPerBorrower.values());
  const qualifyingMonthly = current.reduce(
    (sum, c) => sum + (c.calculated_income != null ? Number(c.calculated_income) : 0),
    0,
  );

  const loanAmount =
    lead.loan_amount != null
      ? Number(lead.loan_amount)
      : lead.original_loan_amount != null
        ? Number(lead.original_loan_amount)
        : null;

  const hasCalcs = current.length > 0;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Income Analysis</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Qualifying income computed for this file. Drives the DTI worksheet and lender eligibility.
        </p>
      </div>

      {/* Summary band */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 grid grid-cols-3 gap-5">
        <div>
          <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Qualifying / month</p>
          <p className="text-[26px] font-bold tabular-nums leading-none mt-1.5 text-[var(--c-text)]">
            {hasCalcs ? money(qualifyingMonthly) : dtiMonthly != null ? money(dtiMonthly) : '—'}
          </p>
          <p className="text-[11px] text-[var(--c-label3)] mt-1">
            {hasCalcs
              ? `${current.length} borrower${current.length > 1 ? 's' : ''} · latest calc`
              : dtiMonthly != null
                ? 'From DTI worksheet'
                : 'Not yet computed'}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Qualifying / year</p>
          <p className="text-[26px] font-bold tabular-nums leading-none mt-1.5 text-[var(--c-text)]">
            {hasCalcs ? money(qualifyingMonthly * 12) : dtiMonthly != null ? money(dtiMonthly * 12) : '—'}
          </p>
          <p className="text-[11px] text-[var(--c-label3)] mt-1">Annualized</p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">Loan amount</p>
          <p className="text-[26px] font-bold tabular-nums leading-none mt-1.5 text-[var(--c-text)]">
            {loanAmount != null ? money(loanAmount) : '—'}
          </p>
          <p className="text-[11px] text-[var(--c-label3)] mt-1">On file</p>
        </div>
      </div>

      {/* Per-borrower computed income */}
      {hasCalcs ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--c-border)]">
            <p className="text-[13px] font-semibold text-[var(--c-text)]">Computed income by borrower</p>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--c-label3)]">
                <th className="px-5 py-2 font-medium">Borrower</th>
                <th className="px-5 py-2 font-medium">Income type</th>
                <th className="px-5 py-2 font-medium">Agency</th>
                <th className="px-5 py-2 font-medium text-right">Qualifying / mo</th>
              </tr>
            </thead>
            <tbody>
              {current.map((c) => (
                <tr key={c.id} className="border-t border-[var(--c-border)]">
                  <td className="px-5 py-3 text-[var(--c-text)] capitalize">
                    {(c.borrower_type ?? 'primary').replace('_', '-')}
                  </td>
                  <td className="px-5 py-3 text-[var(--c-label2)]">
                    {c.income_type ? (INCOME_TYPE_LABEL[c.income_type] ?? c.income_type) : '—'}
                  </td>
                  <td className="px-5 py-3 text-[var(--c-label2)] uppercase">{c.agency ?? 'both'}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-[var(--c-text)]">
                    {c.calculated_income != null ? money(Number(c.calculated_income)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[var(--c-border)] bg-[var(--c-fill)]">
                <td className="px-5 py-3 font-semibold text-[var(--c-text)]" colSpan={3}>
                  Total qualifying income
                </td>
                <td className="px-5 py-3 text-right tabular-nums font-bold text-[var(--c-gold-deep)]">
                  {money(qualifyingMonthly)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-8 text-center">
          <p className="text-[14px] font-semibold text-[var(--c-text)]">No income calculated yet</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 max-w-md mx-auto leading-relaxed">
            Run a W-2, self-employed, bank-statement, asset-depletion, or 1099 calculation in the Income
            Calculators, then it appears here and flows into the DTI worksheet.
          </p>
          <Link
            href="/income"
            className="inline-flex mt-4 items-center gap-1.5 rounded-[10px] bg-[var(--c-gold-deep)] px-4 py-2 text-[13px] font-semibold text-white"
          >
            Open Income Calculators
          </Link>
        </div>
      )}

      {/* Recent calculation notes */}
      {calcs.some((c) => c.calculation_notes) && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 space-y-2">
          <p className="text-[13px] font-semibold text-[var(--c-text)]">Calculation notes</p>
          {calcs
            .filter((c) => c.calculation_notes)
            .slice(0, 4)
            .map((c) => (
              <p key={c.id} className="text-[12px] text-[var(--c-label2)] leading-relaxed">
                <span className="text-[var(--c-label3)]">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString() : ''} ·{' '}
                  {c.income_type ? (INCOME_TYPE_LABEL[c.income_type] ?? c.income_type) : 'calc'} —{' '}
                </span>
                {c.calculation_notes}
              </p>
            ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-[var(--c-label3)]">
          {hasCalcs
            ? 'Showing the latest calculation per borrower. Earlier runs are retained in the audit trail.'
            : 'Income figures are stored as an immutable audit trail per Fannie/Freddie review.'}
        </p>
        <Link href="/income" className="text-[12px] font-semibold text-[var(--c-gold-deep)]">
          Income Calculators →
        </Link>
      </div>
    </div>
  );
}
