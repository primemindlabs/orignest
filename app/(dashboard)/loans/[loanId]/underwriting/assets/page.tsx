import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { ReservesWorksheet } from './ReservesWorksheet';

export const dynamic = 'force-dynamic';

// Rough PITIA estimate used only as a starting point when the application has no
// proposed housing payment on file. Assumes a 30-yr P&I at ~7% plus a flat
// taxes/insurance allowance of ~25% of P&I. The user can override the monthly
// housing figure in the worksheet, so this just seeds a sensible default.
function estimateMonthlyHousing(loanAmount: number): number {
  if (!loanAmount || loanAmount <= 0) return 0;
  const monthlyRate = 0.07 / 12;
  const n = 360;
  const pi = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  return Math.round(pi * 1.25);
}

export default async function AssetsPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, loan_amount')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // Pull the most recently updated application row for this loan (the 1003 the
  // borrower filled out). Defensive: the table/columns may be empty for older loans.
  let app:
    | {
        checking_balance: number | null;
        savings_balance: number | null;
        retirement_balance: number | null;
        other_assets: number | null;
        down_payment_amount: number | null;
        gross_monthly_income: number | null;
        updated_at: string | null;
      }
    | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select(
        'checking_balance, savings_balance, retirement_balance, other_assets, down_payment_amount, gross_monthly_income, updated_at',
      )
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    app = data ?? null;
  } catch {
    app = null;
  }

  const loanAmount = lead.loan_amount != null ? Number(lead.loan_amount) : 0;
  const estimatedHousing = estimateMonthlyHousing(loanAmount);

  const accounts = [
    { key: 'checking', label: 'Checking', value: Number(app?.checking_balance ?? 0), reserveFactor: 1 },
    { key: 'savings', label: 'Savings', value: Number(app?.savings_balance ?? 0), reserveFactor: 1 },
    {
      key: 'retirement',
      label: 'Retirement (vested)',
      value: Number(app?.retirement_balance ?? 0),
      reserveFactor: 0.7,
    },
    { key: 'other', label: 'Other assets', value: Number(app?.other_assets ?? 0), reserveFactor: 1 },
  ];

  const hasAnyAssets = accounts.some((a) => a.value > 0);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Assets &amp; Reserves</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Liquid assets from the application, less funds to close, measured against the proposed housing
          payment to estimate months of reserves.
        </p>
      </div>

      {!hasAnyAssets && (
        <div className="bg-[var(--c-fill)] border border-[var(--c-border)] rounded-[14px] p-5">
          <p className="text-[13px] text-[var(--c-label2)]">
            No asset balances are on file yet. They populate automatically from the borrower&apos;s 1003
            application. You can still enter figures below to model reserves manually — nothing is saved.
          </p>
        </div>
      )}

      <ReservesWorksheet
        accounts={accounts}
        downPayment={Number(app?.down_payment_amount ?? 0)}
        defaultMonthlyHousing={estimatedHousing}
        loanAmount={loanAmount}
        applicationOnFile={!!app}
      />
    </div>
  );
}
