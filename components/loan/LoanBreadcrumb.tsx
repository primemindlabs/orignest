'use client';

/**
 * Phase 28.1 — Auto-generated breadcrumb from the pathname + loan name.
 * e.g. Pipeline › Williams, Jordan › Underwriting › DTI Worksheet
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  '1003': '1003', borrower: 'Borrower', 'co-borrower': 'Co-Borrower', employment: 'Employment',
  income: 'Income', assets: 'Assets', 'real-estate': 'Real Estate Owned', 'loan-property': 'Loan & Property',
  declarations: 'Declarations', hmda: 'HMDA Data', underwriting: 'Underwriting', dti: 'DTI Worksheet',
  credit: 'Credit Analysis', hoa: 'HOA', risk: 'Risk Score', conditions: 'Conditions', decision: 'Decision',
  disclosures: 'Disclosures', 'loan-estimates': 'Loan Estimates', 'cd-balancer': 'CD Balancer',
  'changed-circumstances': 'Changed Circumstances', 'wire-safety': 'Wire Safety', audit: 'Audit Export',
  documents: 'Documents', portal: 'Portal & Comms', timeline: 'Timeline', relationships: 'Relationships',
};

export function LoanBreadcrumb({ loanId, loanName }: { loanId: string; loanName: string }) {
  const pathname = usePathname();
  const base = `/loans/${loanId}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : '';
  const segments = rest.split('/').filter(Boolean);

  const crumbs: { label: string; href: string }[] = [
    { label: 'Pipeline', href: '/pipeline' },
    { label: loanName || 'Loan', href: base },
  ];
  let acc = base;
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ label: SEGMENT_LABELS[seg] ?? seg, href: acc });
  }

  return (
    <nav className="flex items-center gap-1.5 px-5 py-2 border-b border-[var(--c-border)] bg-[var(--c-surface2)] text-[12px] overflow-x-auto">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1.5 flex-shrink-0">
            {i > 0 && <ChevronRight size={12} className="text-[var(--c-label3)]" />}
            {last ? (
              <span className="text-[var(--c-text)] font-medium">{c.label}</span>
            ) : (
              <Link href={c.href} className="text-[var(--c-label2)] hover:text-[var(--c-text)] transition-colors">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
