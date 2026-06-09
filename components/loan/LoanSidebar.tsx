'use client';

/**
 * Phase 28.1 — Contextual loan sidebar. Top-level sections always visible;
 * a section's sub-items expand when it's active. `showIf` predicates take the
 * LoanContext, hiding sub-items that don't apply to this loan entirely.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Shield, FileCheck, CheckSquare, Folder, MessageSquare, Clock, Users,
} from 'lucide-react';
import type { LoanContext } from '@/lib/ui/fieldAdapter';

interface SubItem {
  label: string;
  href: string;
  showIf?: (ctx: LoanContext) => boolean;
}
interface NavSection {
  key: string;
  label: string;
  href: string;
  icon: React.ElementType;
  sub?: SubItem[];
}

const LOAN_NAV: NavSection[] = [
  { key: 'overview', label: 'Overview', href: '', icon: LayoutDashboard },
  {
    key: '1003', label: '1003', href: '/1003', icon: FileText,
    sub: [
      { label: 'Borrower Info', href: '/1003/borrower' },
      { label: 'Co-Borrower', href: '/1003/co-borrower', showIf: (c) => c.has_co_borrower },
      { label: 'Employment', href: '/1003/employment' },
      { label: 'Income', href: '/1003/income' },
      { label: 'Assets', href: '/1003/assets' },
      { label: 'Real Estate Owned', href: '/1003/real-estate', showIf: (c) => c.has_reo },
      { label: 'Loan & Property', href: '/1003/loan-property' },
      { label: 'Declarations', href: '/1003/declarations' },
      { label: 'HMDA Data', href: '/1003/hmda' },
    ],
  },
  {
    key: 'underwriting', label: 'Underwriting', href: '/underwriting', icon: Shield,
    sub: [
      { label: 'DTI Worksheet', href: '/underwriting/dti' },
      { label: 'Income Analysis', href: '/underwriting/income' },
      { label: 'Assets & Reserves', href: '/underwriting/assets' },
      { label: 'Credit Analysis', href: '/underwriting/credit' },
      { label: 'HOA', href: '/underwriting/hoa', showIf: (c) => ['Condo', 'PUD'].includes(c.property_type) },
      { label: 'Risk Score', href: '/underwriting/risk' },
      { label: 'Conditions', href: '/underwriting/conditions' },
      { label: 'Decision', href: '/underwriting/decision' },
    ],
  },
  {
    key: 'disclosures', label: 'Disclosures', href: '/disclosures', icon: FileCheck,
    sub: [
      { label: 'Loan Estimates', href: '/disclosures/loan-estimates' },
      { label: 'CD Balancer', href: '/disclosures/cd-balancer' },
      { label: 'Changed Circs', href: '/disclosures/changed-circumstances' },
      { label: 'Wire Safety', href: '/disclosures/wire-safety' },
      { label: 'Audit Export', href: '/disclosures/audit' },
    ],
  },
  { key: 'conditions', label: 'Conditions', href: '/conditions', icon: CheckSquare },
  { key: 'documents', label: 'Documents', href: '/documents', icon: Folder },
  { key: 'portal', label: 'Portal & Comms', href: '/portal', icon: MessageSquare },
  { key: 'timeline', label: 'Timeline', href: '/timeline', icon: Clock },
  { key: 'relationships', label: 'Relationships', href: '/relationships', icon: Users },
];

export function LoanSidebar({ loanId, loanContext }: { loanId: string; loanContext: LoanContext }) {
  const pathname = usePathname();
  const base = `/loans/${loanId}`;

  function sectionActive(section: NavSection): boolean {
    if (section.href === '') return pathname === base;
    return pathname.startsWith(base + section.href);
  }

  return (
    <aside className="flex-shrink-0 w-[208px] border-r border-[var(--c-border)] bg-[var(--c-surface)] overflow-y-auto py-3">
      <nav className="px-2.5 space-y-0.5">
        {LOAN_NAV.map((section) => {
          const href = base + section.href;
          const active = sectionActive(section);
          const Icon = section.icon;
          const subs = (section.sub ?? []).filter((s) => !s.showIf || s.showIf(loanContext));
          return (
            <div key={section.key}>
              <Link
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-medium transition-colors ${
                  active ? 'bg-[var(--c-gold-light)] text-[var(--c-gold-deep)]' : 'text-[var(--c-label2)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text)]'
                }`}
              >
                <Icon size={15} className={active ? 'text-[var(--c-gold)]' : 'text-[var(--c-label3)]'} />
                <span className="flex-1">{section.label}</span>
              </Link>
              {active && subs.length > 0 && (
                <div className="ml-[26px] mt-0.5 mb-1 space-y-0.5 border-l border-[var(--c-border)] pl-2.5">
                  {subs.map((s) => {
                    const subHref = base + s.href;
                    const subActive = pathname === subHref;
                    return (
                      <Link
                        key={s.href}
                        href={subHref}
                        className={`block px-2.5 py-1.5 rounded-[8px] text-[12px] transition-colors ${
                          subActive ? 'text-[var(--c-gold-deep)] font-medium bg-[var(--c-gold-light)]' : 'text-[var(--c-label2)] hover:text-[var(--c-text)] hover:bg-[var(--c-fill)]'
                        }`}
                      >
                        {s.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
