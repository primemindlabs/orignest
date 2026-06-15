import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function money(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(n: number | null): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

export default async function PricingPage({ params }: { params: { loanId: string } }) {
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

  const loanAmount = lead.loan_amount != null ? Number(lead.loan_amount) : null;
  const estValue = lead.estimated_value != null ? Number(lead.estimated_value) : null;
  const downPayment = lead.down_payment != null ? Number(lead.down_payment) : null;
  // purchase_price may not exist on every schema — read defensively off the row.
  const ppRaw = (lead as Record<string, unknown>).purchase_price;
  const purchasePrice = ppRaw != null ? Number(ppRaw) : null;
  const baseValue = purchasePrice ?? estValue ?? null;

  // Derive LTV: prefer stored value, else compute from loan amount / value
  let ltv: number | null = lead.ltv != null ? Number(lead.ltv) : null;
  if (ltv == null && loanAmount != null && baseValue && baseValue > 0) {
    ltv = (loanAmount / baseValue) * 100;
  }

  // Derive down payment if not stored but value + loan amount are known
  let derivedDown: number | null = downPayment;
  if (derivedDown == null && baseValue != null && loanAmount != null) {
    const d = baseValue - loanAmount;
    derivedDown = d > 0 ? d : null;
  }

  const loanType = (lead.loan_type as string | null) ?? null;
  const loanPurpose = (lead.loan_purpose as string | null) ?? null;

  // LTV-driven pricing notes (lightweight, deterministic)
  const ltvNote =
    ltv == null
      ? 'Enter a value and loan amount to compute LTV-based pricing adjustments.'
      : ltv > 80
      ? 'Above 80% LTV — mortgage insurance and LLPA adjustments likely apply.'
      : ltv > 60
      ? 'Standard LTV tier — competitive pricing available across programs.'
      : 'Low LTV — strongest pricing tier and best LLPA treatment.';

  const stats: { label: string; value: string; note?: string }[] = [
    { label: 'Loan Amount', value: money(loanAmount) },
    { label: 'Property Value', value: money(baseValue), note: purchasePrice != null ? 'Purchase price' : 'Estimated value' },
    { label: 'Down Payment', value: money(derivedDown), note: downPayment == null && derivedDown != null ? 'Derived' : undefined },
    { label: 'LTV', value: pct(ltv), note: lead.ltv == null && ltv != null ? 'Computed' : undefined },
  ];

  const id = params.loanId;
  const cards: { href: string; title: string; desc: string; external?: boolean }[] = [
    { href: `/loans/${id}/pricing/rate-options`, title: 'Rate Options', desc: 'Compare available rates and points for this loan profile.' },
    { href: `/loans/${id}/pricing/rate-lock`, title: 'Rate Lock', desc: 'Lock status, expiration, and extension workflow.' },
    { href: `/loans/${id}/pricing/break-even`, title: 'Break-Even', desc: 'Points vs. monthly savings — find the break-even horizon.' },
    { href: `/loans/${id}/scenarios`, title: 'Scenario Builder', desc: 'Side-by-side payment scenarios for this borrower.' },
    { href: `/pricing`, title: 'Pricing Engine', desc: 'Run the global pricing engine across products and LLPAs.', external: true },
    { href: `/rate-sheets`, title: 'Rate Sheet Parser', desc: 'Paste a lender rate sheet to extract pricing and adjustments.', external: true },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Pricing</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Pricing overview for this loan — key figures plus the rate, lock, and scenario tools.
        </p>
      </div>

      {/* Snapshot */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide">{s.label}</p>
              <p className="text-[20px] font-bold text-[var(--c-text)] tabular-nums leading-tight mt-0.5">{s.value}</p>
              {s.note ? <p className="text-[11px] text-[var(--c-label3)] mt-0.5">{s.note}</p> : null}
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-[var(--c-border)] flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-[var(--c-label2)]">
          {loanType ? (
            <span>
              Program: <span className="font-medium text-[var(--c-text)] capitalize">{loanType.replace(/_/g, ' ')}</span>
            </span>
          ) : null}
          {loanPurpose ? (
            <span>
              Purpose: <span className="font-medium text-[var(--c-text)] capitalize">{loanPurpose.replace(/_/g, ' ')}</span>
            </span>
          ) : null}
        </div>
        <p className="text-[12px] text-[var(--c-label3)] mt-3 leading-relaxed">{ltvNote}</p>
      </div>

      {/* Tool cards */}
      <div>
        <p className="text-[11px] text-[var(--c-label3)] uppercase tracking-wide mb-2">Pricing Tools</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] p-4 hover:border-[var(--c-gold-deep)] transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-[var(--c-text)] group-hover:text-[var(--c-gold-deep)] transition-colors">
                  {c.title}
                </p>
                {c.external ? (
                  <span className="text-[10px] text-[var(--c-label3)] border border-[var(--c-border)] rounded-full px-1.5 py-0.5">
                    Global
                  </span>
                ) : null}
              </div>
              <p className="text-[12px] text-[var(--c-label2)] mt-1 leading-relaxed">{c.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
