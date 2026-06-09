import { getLoanSummary } from '@/lib/loans/getLoanSummary';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Calculator, TrendingUp, Wallet, CreditCard, Home, Gauge, CheckSquare, Gavel } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UnderwritingIndexPage({ params }: { params: { loanId: string } }) {
  const loan = await getLoanSummary(params.loanId);
  if (!loan) notFound();
  const base = `/loans/${loan.id}/underwriting`;
  const isCondoPud = ['Condo', 'PUD'].includes(loan.context.property_type);

  const items = [
    { href: `${base}/dti`, label: 'DTI Worksheet', desc: 'Front/back-end ratios', icon: Calculator },
    { href: `${base}/income`, label: 'Income Analysis', desc: 'Qualifying income', icon: TrendingUp },
    { href: `${base}/assets`, label: 'Assets & Reserves', desc: 'Reserve months', icon: Wallet },
    { href: `${base}/credit`, label: 'Credit Analysis', desc: 'Tradelines & tier', icon: CreditCard },
    ...(isCondoPud ? [{ href: `${base}/hoa`, label: 'HOA', desc: 'Dues & certification', icon: Home }] : []),
    { href: `${base}/risk`, label: 'Risk Score', desc: 'Layered risk', icon: Gauge },
    { href: `${base}/conditions`, label: 'Conditions', desc: 'UW conditions', icon: CheckSquare },
    { href: `${base}/decision`, label: 'Decision', desc: 'Approve / suspend / deny', icon: Gavel },
  ];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Underwriting</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          DTI {loan.dti != null ? `${loan.dti}%` : 'not run'} · Risk {loan.riskScore ?? 'not scored'} · {loan.openConditions} open conditions
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {items.map(({ href, label, desc, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-4 py-3 hover:bg-[var(--c-fill)] transition-colors">
            <div className="w-8 h-8 rounded-[9px] bg-[var(--c-fill)] flex items-center justify-center flex-shrink-0">
              <Icon size={15} className="text-[var(--c-label2)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--c-text)]">{label}</p>
              <p className="text-[11px] text-[var(--c-label2)]">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
