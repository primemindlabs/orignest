'use client';

/**
 * Phase 29.1 — Loan file sidebar, 8 top-level groups. Top-level sections always
 * visible; a section's sub-items expand when active. `showIf` predicates take the
 * LoanContext, hiding sub-items that don't apply to this loan entirely.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, DollarSign, Home, Shield, FileCheck, FolderCheck, MessageSquare,
} from 'lucide-react';
import type { LoanContext } from '@/lib/ui/fieldAdapter';

interface SubItem { label: string; href: string; showIf?: (ctx: LoanContext) => boolean }
interface NavSection { key: string; label: string; href: string; icon: React.ElementType; sub?: SubItem[] }

const LOAN_NAV: NavSection[] = [
  { key: 'overview', label: 'Overview', href: '', icon: LayoutDashboard },
  {
    key: 'application', label: 'Application', href: '/application', icon: FileText,
    sub: [
      { label: '1003 — Borrower', href: '/application/borrower' },
      { label: '1003 — Co-Borrower', href: '/application/co-borrower', showIf: (c) => c.has_co_borrower },
      { label: '1003 — Employment', href: '/application/employment' },
      { label: '1003 — Income', href: '/application/income' },
      { label: '1003 — Assets', href: '/application/assets' },
      { label: '1003 — Real Estate Owned', href: '/application/real-estate', showIf: (c) => c.has_reo },
      { label: '1003 — Loan & Property', href: '/application/loan-property' },
      { label: '1003 — Declarations', href: '/application/declarations' },
      { label: 'HMDA Data', href: '/application/hmda' },
    ],
  },
  {
    key: 'pricing', label: 'Pricing', href: '/pricing', icon: DollarSign,
    sub: [
      { label: 'Rate Options', href: '/pricing/rate-options' },
      { label: 'Rate Lock', href: '/pricing/rate-lock' },
      { label: 'Break-Even Analysis', href: '/pricing/break-even' },
    ],
  },
  {
    key: 'property', label: 'Property', href: '/property', icon: Home,
    sub: [
      { label: 'Property Details', href: '/property/details' },
      { label: 'Appraisal', href: '/property/appraisal' },
      { label: 'Flood Zone', href: '/property/flood-zone' },
      { label: 'HOA Certification', href: '/property/hoa', showIf: (c) => ['Condo', 'PUD'].includes(c.property_type) },
    ],
  },
  {
    key: 'underwriting', label: 'Underwriting', href: '/underwriting', icon: Shield,
    sub: [
      { label: 'DTI Worksheet', href: '/underwriting/dti' },
      { label: 'Income Analysis', href: '/underwriting/income' },
      { label: 'Assets & Reserves', href: '/underwriting/assets' },
      { label: 'Credit Analysis', href: '/underwriting/credit' },
      { label: 'Risk Score', href: '/underwriting/risk' },
      { label: 'Conditions', href: '/underwriting/conditions' },
      { label: 'UW Decision', href: '/underwriting/decision' },
    ],
  },
  {
    key: 'disclosures', label: 'Disclosures', href: '/disclosures', icon: FileCheck,
    sub: [
      { label: 'Loan Estimates', href: '/disclosures/loan-estimates' },
      { label: 'CD Balancer', href: '/disclosures/cd-balancer' },
      { label: 'Changed Circumstances', href: '/disclosures/changed-circumstances' },
      { label: 'Wire Safety', href: '/disclosures/wire-safety' },
      { label: 'Audit Export', href: '/disclosures/audit' },
    ],
  },
  {
    key: 'docs-compliance', label: 'Docs & Compliance', href: '/docs-compliance', icon: FolderCheck,
    sub: [
      { label: 'Documents', href: '/docs-compliance/documents' },
      { label: 'AI Auto-Population', href: '/docs-compliance/auto-extract' },
      { label: 'Conditions', href: '/docs-compliance/conditions' },
      { label: 'Expirations', href: '/docs-compliance/expirations' },
      { label: 'Dual Role Check', href: '/docs-compliance/dual-role-check' },
      { label: 'Adverse Action', href: '/docs-compliance/adverse-action' },
      { label: 'Fair Lending Flags', href: '/docs-compliance/fair-lending-flags' },
    ],
  },
  {
    key: 'portal-comms', label: 'Portal & Comms', href: '/portal-comms', icon: MessageSquare,
    sub: [
      { label: 'Borrower Portal', href: '/portal-comms/borrower-portal' },
      { label: 'Realtor Access', href: '/portal-comms/realtor-access' },
      { label: 'Education Suite', href: '/portal-comms/education-suite' },
      { label: 'Milestone Communications', href: '/portal-comms/milestone-communications' },
      { label: 'Rate Alerts & Monitoring', href: '/portal-comms/rate-alerts' },
      { label: 'Competitor Analysis', href: '/portal-comms/competitor-analysis' },
    ],
  },
];

export function LoanSidebar({ loanId, loanContext }: { loanId: string; loanContext: LoanContext }) {
  const pathname = usePathname();
  const base = `/loans/${loanId}`;

  function sectionActive(section: NavSection): boolean {
    if (section.href === '') return pathname === base;
    return pathname.startsWith(base + section.href);
  }

  return (
    <aside className="flex-shrink-0 w-[212px] border-r border-[var(--c-border)] bg-[var(--c-surface)] overflow-y-auto py-3">
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
                className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-medium transition-colors border-l-[3px] ${
                  active
                    ? 'bg-[var(--c-gold-light)] text-[var(--c-gold-deep)] border-[var(--c-gold)]'
                    : 'text-[var(--c-label2)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text)] border-transparent'
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
                          subActive
                            ? 'text-[var(--c-gold-deep)] font-medium bg-[var(--c-gold-light)]'
                            : 'text-[var(--c-label2)] hover:text-[var(--c-text)] hover:bg-[var(--c-fill)]'
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
