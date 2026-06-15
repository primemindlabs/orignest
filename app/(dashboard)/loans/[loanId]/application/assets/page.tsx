import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

// Labels mirror components/apply/sections/AssetsSection.tsx
const ASSET_FIELDS: { key: string; label: string }[] = [
  { key: 'checking_balance', label: 'Checking' },
  { key: 'savings_balance', label: 'Savings' },
  { key: 'retirement_balance', label: 'Retirement' },
  { key: 'other_assets', label: 'Other assets' },
];

function fmt(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function AssetsPage({ params }: { params: { loanId: string } }) {
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

  // Pull the borrower's submitted 1003 application (most recent), if any.
  let app: Record<string, unknown> | null = null;
  try {
    const { data } = await sb
      .from('applications')
      .select(
        'id, status, checking_balance, savings_balance, retirement_balance, other_assets, monthly_debts, updated_at',
      )
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    app = (data as Record<string, unknown> | null) ?? null;
  } catch {
    app = null;
  }

  const rows = ASSET_FIELDS.map((f) => ({ ...f, amount: num(app?.[f.key]) }));
  const totalAssets = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const monthlyDebts = num(app?.monthly_debts);
  const hasAnyAsset = rows.some((r) => r.amount != null);
  const hasApp = app != null;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Assets (1003)</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Reserves and balances the borrower reported on their digital application.
        </p>
      </div>

      {!hasApp || !hasAnyAsset ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-6 text-center">
          <p className="text-[15px] font-semibold text-[var(--c-text)]">
            {hasApp ? 'No assets reported yet' : 'No application on file'}
          </p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 max-w-sm mx-auto leading-relaxed">
            {hasApp
              ? 'The borrower started the 1003 but has not entered any account balances. Reopen the application to capture assets and debts.'
              : 'Send the borrower a Smart 1003 to collect their checking, savings, retirement, and other assets.'}
          </p>
          <Link
            href={`/loans/${params.loanId}/apply-1003`}
            className="inline-flex items-center mt-4 px-4 py-2 rounded-[10px] text-[13px] font-semibold text-white bg-[var(--c-gold-deep)] hover:opacity-90 transition-opacity"
          >
            {hasApp ? 'Open the 1003' : 'Start a 1003 application'}
          </Link>
        </div>
      ) : (
        <>
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
            {rows.map((r, i) => (
              <div
                key={r.key}
                className={`flex items-center justify-between px-5 py-3.5 ${
                  i > 0 ? 'border-t border-[var(--c-border)]' : ''
                }`}
              >
                <span className="text-[14px] text-[var(--c-label2)]">{r.label}</span>
                <span
                  className={`text-[14px] tabular-nums font-medium ${
                    r.amount == null ? 'text-[var(--c-label3)]' : 'text-[var(--c-text)]'
                  }`}
                >
                  {fmt(r.amount)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--c-border)] bg-[var(--c-fill)]">
              <span className="text-[14px] font-semibold text-[var(--c-text)]">Total assets</span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--c-gold-deep)]">
                {fmt(totalAssets)}
              </span>
            </div>
          </div>

          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-5 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-[14px] text-[var(--c-label2)]">Total monthly debt payments</p>
              <p className="text-[11px] text-[var(--c-label3)] mt-0.5">
                Car loans, student loans, credit cards, and other obligations.
              </p>
            </div>
            <span
              className={`text-[14px] tabular-nums font-medium ${
                monthlyDebts == null ? 'text-[var(--c-label3)]' : 'text-[var(--c-text)]'
              }`}
            >
              {fmt(monthlyDebts)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[12px] text-[var(--c-label3)]">
              {app?.status === 'submitted' || app?.status === 'reviewed'
                ? 'Submitted by the borrower on their 1003.'
                : 'Draft figures — borrower has not yet submitted the 1003.'}
            </p>
            <Link
              href={`/loans/${params.loanId}/apply-1003`}
              className="text-[12px] font-semibold text-[var(--c-gold-deep)] hover:underline"
            >
              View application
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
