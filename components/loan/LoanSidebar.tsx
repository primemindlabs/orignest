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

// Only real, implemented pages are linked here — every entry below resolves to a
// built page (no "under construction" placeholders). Stub routes still exist on
// disk but are intentionally unlinked.
const LOAN_NAV: NavSection[] = [
  { key: 'overview', label: 'Overview', href: '', icon: LayoutDashboard },
  { key: 'application', label: 'Application (1003)', href: '/apply-1003', icon: FileText },
  {
    key: 'pricing', label: 'Pricing & Scenarios', href: '/scenarios', icon: DollarSign,
    sub: [
      { label: 'Scenario Builder', href: '/scenarios' },
      { label: 'Loan Proposal', href: '/proposal' },
      { label: 'Construction Loan', href: '/construction' },
    ],
  },
  {
    key: 'property', label: 'Property', href: '/property/flood-zone', icon: Home,
    sub: [
      { label: 'Flood Zone', href: '/property/flood-zone' },
      { label: 'HOA Warrantability', href: '/hoa', showIf: (c) => ['Condo', 'PUD'].includes(c.property_type) },
      { label: 'Appraisal Waiver Check', href: '/waiver-check' },
    ],
  },
  {
    key: 'underwriting', label: 'Underwriting', href: '/underwriting/dti', icon: Shield,
    sub: [
      { label: 'DTI Worksheet', href: '/underwriting/dti' },
      { label: 'Credit Analysis', href: '/underwriting/credit' },
      { label: 'Risk Score', href: '/underwriting/risk' },
      { label: 'Conditions', href: '/underwriting/conditions' },
      { label: 'UW Decision', href: '/underwriting/decision' },
      { label: 'Pre-Submission Check', href: '/dti-check' },
      { label: 'LOE Builder', href: '/loe' },
    ],
  },
  {
    key: 'docs-compliance', label: 'Docs & Compliance', href: '/docs-compliance/smart-checklist', icon: FolderCheck,
    sub: [
      { label: 'Smart Checklist', href: '/docs-compliance/smart-checklist' },
      { label: 'AI Auto-Population', href: '/docs-compliance/auto-extract' },
      { label: 'Conditions', href: '/docs-compliance/conditions' },
      { label: 'Identity Verification', href: '/identity' },
      { label: 'Documents & Signatures', href: '/signatures' },
      { label: 'CD Balancer', href: '/disclosures/cd-balancer' },
    ],
  },
  {
    key: 'closing', label: 'Closing', href: '/title', icon: FileCheck,
    sub: [
      { label: 'Title & Closing', href: '/title' },
      { label: 'Closing Post', href: '/closing-post' },
    ],
  },
  {
    key: 'portal-comms', label: 'Portal & Comms', href: '/portal-comms/chat', icon: MessageSquare,
    sub: [
      { label: 'Loan Chat', href: '/portal-comms/chat' },
      { label: 'Borrower Portal', href: '/portal-comms/borrower-portal' },
      { label: 'Internal Team Chat', href: '/internal-chat' },
      { label: 'Competitor Analysis', href: '/portal-comms/competitor-analysis' },
    ],
  },
];

export function LoanSidebar({ loanId, loanContext }: { loanId: string; loanContext: LoanContext }) {
  const pathname = usePathname();
  const base = `/loans/${loanId}`;

  function sectionActive(section: NavSection): boolean {
    if (section.href === '') return pathname === base;
    // A section is active if its header href OR any of its sub hrefs matches —
    // sub hrefs no longer share a common prefix with the header.
    const hrefs = [section.href, ...(section.sub ?? []).map((s) => s.href)];
    return hrefs.some((h) => pathname.startsWith(base + h));
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
