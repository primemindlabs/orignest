import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { applyLlpas, type Llpa } from '@/lib/rateSheets/query';

export const dynamic = 'force-dynamic';

interface PricedOption {
  lender_name: string;
  sheet_id: string;
  loan_type: string;
  term_years: number;
  amortization_type: string;
  base_rate: number;
  base_price: number;
  total_llpa: number;
  adjusted_price: number;
  lock_period_days: number | null;
  applied: { adjuster_name: string; adjustment: number }[];
}

// Maps the lead's loan_purpose enum to the LLPA loan_purpose vocabulary used on rate sheets.
function normalizePurpose(p: string | null): string | null {
  if (!p) return null;
  if (p === 'rate_term_refinance') return 'rate_term_refi';
  if (p === 'cash_out_refinance') return 'cash_out';
  return p; // 'purchase', 'heloc', 'construction'
}

function fmtPrice(n: number): string {
  return n.toFixed(3);
}

function llpaTone(total: number): string {
  if (total > 0) return 'var(--c-success)';
  if (total < 0) return 'var(--c-danger)';
  return 'var(--c-label2)';
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, credit_score, loan_type, loan_purpose, loan_amount, estimated_value, down_payment, ltv')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // ---- Derive pricing inputs defensively from whatever the file has on record ----
  const fico = lead.credit_score != null ? Number(lead.credit_score) : null;
  const loanType = lead.loan_type ? String(lead.loan_type).toLowerCase() : null;
  const loanPurpose = normalizePurpose(lead.loan_purpose ?? null);
  const loanAmount = lead.loan_amount != null ? Number(lead.loan_amount) : 0;
  const propertyValue = lead.estimated_value != null ? Number(lead.estimated_value) : 0;

  let ltv: number | null = lead.ltv != null ? Number(lead.ltv) : null;
  if ((ltv == null || !Number.isFinite(ltv)) && loanAmount > 0 && propertyValue > 0) {
    ltv = Math.round((loanAmount / propertyValue) * 10000) / 100;
  }

  const inputsReady = fico != null && Number.isFinite(fico) && ltv != null && Number.isFinite(ltv) && !!loanType;
  const missing: string[] = [];
  if (fico == null) missing.push('credit score');
  if (ltv == null || !Number.isFinite(ltv)) missing.push('LTV (loan amount + property value)');
  if (!loanType) missing.push('loan type');

  // ---- Pull this LO's active rate sheets and price them against the file ----
  const options: PricedOption[] = [];
  let sheetCount = 0;
  let tableMissing = false;

  if (inputsReady) {
    try {
      const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
      const loId = profile?.id ?? null;

      const today = new Date().toISOString().slice(0, 10);
      let sheetQuery = sb
        .from('rate_sheets')
        .select('id, lender_name, expiration_date')
        .eq('org_id', orgId)
        .eq('is_active', true);
      if (loId) sheetQuery = sheetQuery.eq('lo_id', loId);

      const { data: sheets, error: sheetErr } = await sheetQuery;
      if (sheetErr) {
        tableMissing = true;
      } else {
        const activeSheets = (sheets ?? []).filter(
          (s) => !s.expiration_date || String(s.expiration_date) >= today,
        );
        sheetCount = activeSheets.length;

        for (const sheet of activeSheets) {
          const { data: products } = await sb
            .from('rate_sheet_products')
            .select('*')
            .eq('rate_sheet_id', sheet.id)
            .eq('loan_type', loanType as string);

          const matching = (products ?? []).filter((p) => {
            if (p.min_fico != null && (fico as number) < Number(p.min_fico)) return false;
            if (p.max_fico != null && (fico as number) > Number(p.max_fico)) return false;
            if (p.max_ltv != null && (ltv as number) > Number(p.max_ltv)) return false;
            if (p.min_ltv != null && (ltv as number) < Number(p.min_ltv)) return false;
            if (loanAmount > 0 && p.max_loan_amount != null && loanAmount > Number(p.max_loan_amount)) return false;
            if (loanAmount > 0 && p.min_loan_amount != null && loanAmount < Number(p.min_loan_amount)) return false;
            return true;
          });
          if (matching.length === 0) continue;

          const { data: llpaRows } = await sb.from('rate_sheet_llpas').select('*').eq('rate_sheet_id', sheet.id);
          const llpas = (llpaRows ?? []) as unknown as Llpa[];

          for (const p of matching) {
            const price = applyLlpas(p.base_price != null ? Number(p.base_price) : null, llpas, {
              fico: fico as number,
              ltv: ltv as number,
              loan_purpose: loanPurpose,
            });
            options.push({
              lender_name: sheet.lender_name,
              sheet_id: sheet.id,
              loan_type: p.loan_type,
              term_years: Number(p.term_years),
              amortization_type: p.amortization_type,
              base_rate: Number(p.base_rate),
              base_price: price.base_price,
              total_llpa: price.total_llpa,
              adjusted_price: price.adjusted_price,
              lock_period_days: p.lock_period_days != null ? Number(p.lock_period_days) : null,
              applied: price.applied,
            });
          }
        }

        // Best price first (highest adjusted price = least cost to the borrower), then lowest rate.
        options.sort((a, b) => b.adjusted_price - a.adjusted_price || a.base_rate - b.base_rate);
      }
    } catch {
      tableMissing = true;
    }
  }

  // ---- Shared header + profile chips ----
  const header = (
    <div>
      <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Rate Options</h1>
      <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
        Live pricing from your imported rate sheets, adjusted for this borrower&apos;s profile.
      </p>
    </div>
  );

  const profileBar = (
    <div className="flex flex-wrap gap-2 text-[12px]">
      {[
        { k: 'FICO', v: fico != null ? String(fico) : '—' },
        { k: 'LTV', v: ltv != null && Number.isFinite(ltv) ? `${ltv}%` : '—' },
        { k: 'Type', v: loanType ? loanType.replace(/_/g, ' ') : '—' },
        { k: 'Purpose', v: loanPurpose ? loanPurpose.replace(/_/g, ' ') : '—' },
        { k: 'Amount', v: loanAmount > 0 ? `$${loanAmount.toLocaleString()}` : '—' },
      ].map((c) => (
        <span
          key={c.k}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--c-border)] bg-[var(--c-fill)] px-2.5 py-1"
        >
          <span className="text-[var(--c-label3)] uppercase tracking-wide text-[10px]">{c.k}</span>
          <span className="text-[var(--c-text)] font-medium capitalize">{c.v}</span>
        </span>
      ))}
    </div>
  );

  const EmptyState = ({ title, body }: { title: string; body: string }) => (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-6">
      <p className="text-[15px] font-semibold text-[var(--c-text)]">{title}</p>
      <p className="text-[13px] text-[var(--c-label2)] mt-1.5 leading-relaxed max-w-md">{body}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <Link
          href="/rate-sheets"
          className="inline-flex items-center rounded-[10px] bg-[var(--c-gold-deep)] text-white text-[13px] font-medium px-3.5 py-2 hover:opacity-90 transition-opacity"
        >
          Import a rate sheet
        </Link>
        <Link
          href="/pricing"
          className="inline-flex items-center rounded-[10px] border border-[var(--c-border)] text-[var(--c-text)] text-[13px] font-medium px-3.5 py-2 hover:bg-[var(--c-fill)] transition-colors"
        >
          Open pricing engine
        </Link>
      </div>
    </div>
  );

  if (!inputsReady) {
    return (
      <div className="max-w-3xl space-y-4">
        {header}
        {profileBar}
        <EmptyState
          title="Add this file's pricing inputs first"
          body={`Pricing needs ${missing.join(', ')} on the loan before it can match products. Fill these in on the file, then return to see eligible rate/point options.`}
        />
      </div>
    );
  }

  if (tableMissing || sheetCount === 0) {
    return (
      <div className="max-w-3xl space-y-4">
        {header}
        {profileBar}
        <EmptyState
          title="No active rate sheets to price against"
          body="Import a lender rate sheet to unlock live, LLPA-adjusted rate/point options for this loan. Once a sheet is active, eligible products show here automatically — best price first."
        />
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="max-w-3xl space-y-4">
        {header}
        {profileBar}
        <EmptyState
          title="No eligible products for this profile"
          body={`Your ${sheetCount} active rate ${sheetCount === 1 ? 'sheet has' : 'sheets have'} no ${loanType?.replace(/_/g, ' ')} products that fit this borrower's FICO, LTV, or loan amount. Import another sheet or adjust the terms in the pricing engine.`}
        />
      </div>
    );
  }

  const best = options[0];

  return (
    <div className="max-w-3xl space-y-4">
      {header}
      {profileBar}

      {/* Best option highlight */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-block text-[10px] uppercase tracking-wide font-semibold text-[var(--c-gold-deep)]">
              Best price
            </span>
            <p className="text-[15px] font-semibold text-[var(--c-text)] mt-1">{best.lender_name}</p>
            <p className="text-[12px] text-[var(--c-label2)] mt-0.5 capitalize">
              {best.term_years}-yr {best.amortization_type.replace(/_/g, ' ')}
              {best.lock_period_days ? ` · ${best.lock_period_days}-day lock` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[34px] font-bold tabular-nums leading-none text-[var(--c-text)]">
              {best.base_rate.toFixed(3)}%
            </p>
            <p className="text-[12px] text-[var(--c-label3)] mt-1">price {fmtPrice(best.adjusted_price)}</p>
          </div>
        </div>
      </div>

      {/* Full options table */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--c-label3)] border-b border-[var(--c-border)]">
              <th className="px-4 py-2.5 font-medium">Lender</th>
              <th className="px-4 py-2.5 font-medium">Program</th>
              <th className="px-4 py-2.5 font-medium text-right">Rate</th>
              <th className="px-4 py-2.5 font-medium text-right">Base</th>
              <th className="px-4 py-2.5 font-medium text-right">LLPA</th>
              <th className="px-4 py-2.5 font-medium text-right">Adj. Price</th>
            </tr>
          </thead>
          <tbody>
            {options.map((o, i) => (
              <tr
                key={`${o.sheet_id}-${o.term_years}-${o.amortization_type}-${i}`}
                className="border-b border-[var(--c-border)] last:border-0"
              >
                <td className="px-4 py-3 text-[var(--c-text)] font-medium">{o.lender_name}</td>
                <td className="px-4 py-3 text-[var(--c-label2)] capitalize">
                  {o.term_years}-yr {o.amortization_type.replace(/_/g, ' ')}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--c-text)] font-medium">
                  {o.base_rate.toFixed(3)}%
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--c-label2)]">{fmtPrice(o.base_price)}</td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: llpaTone(o.total_llpa) }}>
                  {o.total_llpa > 0 ? '+' : ''}
                  {fmtPrice(o.total_llpa)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--c-text)] font-semibold">
                  {fmtPrice(o.adjusted_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-[var(--c-label3)] leading-relaxed">
        Price points: 100.000 = par; higher adjusted price = less cost to the borrower. LLPAs applied for this file&apos;s
        FICO, LTV{loanPurpose ? `, and ${loanPurpose.replace(/_/g, ' ')} purpose` : ''}. Run full scenarios in the{' '}
        <Link href="/pricing" className="text-[var(--c-gold-deep)] underline underline-offset-2">
          pricing engine
        </Link>{' '}
        or manage sheets under{' '}
        <Link href="/rate-sheets" className="text-[var(--c-gold-deep)] underline underline-offset-2">
          rate sheets
        </Link>
        .
      </p>
    </div>
  );
}
