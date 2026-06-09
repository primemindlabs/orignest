import { getBorrowerRecord } from '@/lib/relationships/getBorrowerRecord';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Building2, TrendingUp, Cake, History } from 'lucide-react';
import { PortfolioPanel } from '@/components/relationships/PortfolioPanel';

export const dynamic = 'force-dynamic';

export default async function BorrowerOverviewPage({ params }: { params: { id: string } }) {
  const rec = await getBorrowerRecord(params.id);
  if (!rec) notFound();
  const base = `/relationships/borrowers/${rec.id}`;

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Overview</h1>
      <PortfolioPanel properties={rec.properties} totals={rec.totals} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { href: `${base}/portfolio`, label: 'Portfolio', icon: Building2 },
          { href: `${base}/property-intelligence/refi-watch`, label: 'Refi Watch', icon: TrendingUp },
          { href: `${base}/annual-review`, label: 'Annual Review', icon: Cake },
          { href: `${base}/loan-history`, label: 'Loan History', icon: History },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-1.5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-3 py-4 hover:bg-[var(--c-fill)] transition-colors">
            <Icon size={17} className="text-[var(--c-gold)]" />
            <span className="text-[12px] font-medium text-[var(--c-text)] text-center">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
