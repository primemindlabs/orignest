import { getLoanSummary } from '@/lib/loans/getLoanSummary';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FileText, Shield, FileCheck, CheckSquare, Users, MapPin } from 'lucide-react';

export const dynamic = 'force-dynamic';

function dollars(n: number | null): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default async function LoanOverviewPage({ params }: { params: { loanId: string } }) {
  const loan = await getLoanSummary(params.loanId);
  if (!loan) notFound();
  const base = `/loans/${loan.id}`;

  const quickLinks = [
    { href: `${base}/application`, label: '1003 Application', icon: FileText },
    { href: `${base}/underwriting`, label: 'Underwriting', icon: Shield },
    { href: `${base}/disclosures`, label: 'Disclosures', icon: FileCheck },
    { href: `${base}/docs-compliance/conditions`, label: 'Conditions', icon: CheckSquare },
    { href: `${base}/relationships`, label: 'Relationships', icon: Users },
  ];

  const ctx = loan.context;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Loan Overview</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">{loan.borrowerName}</p>
      </div>

      {/* Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Loan Amount', dollars(loan.loanAmount)],
          ['Program', loan.programLabel],
          ['Transaction', loan.transactionLabel],
          ['Occupancy', ctx.occupancy],
        ].map(([label, value]) => (
          <div key={label} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] px-4 py-3.5">
            <p className="text-[11px] font-semibold text-[var(--c-label3)] uppercase tracking-wide mb-1">{label}</p>
            <p className="text-[15px] font-semibold text-[var(--c-text)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Property */}
      {loan.propertyAddress && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--c-fill)] flex items-center justify-center flex-shrink-0">
            <MapPin size={16} className="text-[var(--c-label2)]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[var(--c-label3)] uppercase tracking-wide">Subject Property</p>
            <p className="text-[14px] text-[var(--c-text)] mt-0.5">{loan.propertyAddress}</p>
            <p className="text-[12px] text-[var(--c-label2)] mt-0.5">{ctx.property_type} · {ctx.down_payment_pct}% down</p>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--c-text)] mb-2">Jump to</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[12px] px-4 py-3 hover:bg-[var(--c-fill)] transition-colors">
              <div className="w-8 h-8 rounded-[9px] bg-[var(--c-gold-light)] flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-[var(--c-gold-deep)]" />
              </div>
              <span className="text-[13px] font-medium text-[var(--c-text)]">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
