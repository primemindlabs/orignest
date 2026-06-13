'use client';

import { clsx } from 'clsx';
import { Search, ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationCenter } from '@/components/layout/NotificationCenter';
import { BriefBell } from '@/components/layout/BriefBell';
import { useCommandPalette } from '@/components/providers/CommandPaletteProvider';
import { useNavDrawer } from '@/components/layout/NavDrawerContext';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopbarProps {
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  role?: string;
}

const ROLE_LABELS: Record<string, string> = {
  loan_officer: 'Loan Officer',
  lo: 'Loan Officer',
  branch_manager: 'Branch Manager',
  manager: 'Manager',
  processor: 'Processor',
  ae: 'Account Executive',
  account_executive: 'Account Executive',
  admin: 'Admin',
};

function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);

  const LABELS: Record<string, string> = {
    today: 'Today',
    dashboard: 'Command Center',
    pipeline: 'Pipeline',
    leads: 'Leads',
    applications: 'Applications',
    rates: 'Rates',
    calendar: 'Pipeline Calendar',
    campaigns: 'Campaigns',
    partners: 'Partners',
    reports: 'Reports',
    team: 'Team',
    settings: 'Settings',
    billing: 'Billing',
    'ai-coach': 'AI Coach',
    inbox: 'Inbox',
    'video-messages': 'Video Messages',
    templates: 'Templates',
    reviews: 'Reviews & NPS',
    admin: 'Admin',
    pricing: 'Pricing Engine',
    dscr: 'DSCR / Non-QM',
    commercial: 'Commercial',
    dialer: 'Dialer',
    tasks: 'Tasks',
    broadcast: 'Broadcast',
    lenders: 'Lender Marketplace',
    brokers: 'Brokers',
    revenue: 'Revenue Intelligence',
    commissions: 'Commissions',
    'post-close': 'Post-Close',
    nmls: 'NMLS Compliance',
    'credit-repair': 'Credit Repair',
    processing: 'Processing',
    processor: 'Processor Dashboard',
    organizations: 'My Organizations',
  };

  if (segments.length === 0) return [{ label: 'Dashboard' }];

  return segments.map((seg, i) => {
    const isId = /^[0-9a-f-]{20,}$/.test(seg);
    const label = isId ? 'Detail' : (LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1));
    const href = i < segments.length - 1 ? '/' + segments.slice(0, i + 1).join('/') : undefined;
    return { label, href };
  });
}

export function Topbar({ breadcrumbs: propBreadcrumbs, actions, role }: TopbarProps) {
  const autoBreadcrumbs = useBreadcrumbs();
  const breadcrumbs = propBreadcrumbs ?? autoBreadcrumbs;
  const { setOpen: openCommandPalette } = useCommandPalette();
  const { setOpen: openNavDrawer } = useNavDrawer();

  return (
    <header
      className={clsx(
        'fixed top-0 right-0 z-30 left-0 lg:left-[var(--sidebar-w)]',
        'h-14 transition-[left] duration-150',
        'flex items-center justify-between px-4 sm:px-5 gap-2',
        'bg-[rgba(255,255,255,0.85)] backdrop-blur-[20px]',
        'border-b border-[rgba(60,60,67,0.12)]'
      )}
    >
      {/* Mobile menu trigger */}
      <button
        onClick={() => openNavDrawer(true)}
        className="lg:hidden p-1.5 -ml-1 rounded-lg text-label-2 hover:bg-[rgba(60,60,67,0.08)] flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 min-w-0 flex-1">
        {breadcrumbs.map((crumb, i) => (
          <div key={i} className="flex items-center gap-1 min-w-0">
            {i > 0 && (
              <ChevronRight size={12} className="text-label-3 flex-shrink-0" />
            )}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-[13px] text-label-2 hover:text-black transition-colors truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-[13px] font-semibold text-black truncate">
                {crumb.label}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}

        {/* Role badge */}
        {role && ROLE_LABELS[role] && (
          <span className="hidden md:inline text-[11px] font-medium px-2 py-0.5 rounded-full bg-[rgba(201,169,92,0.12)] text-[var(--c-gold-deep)]">
            {ROLE_LABELS[role]}
          </span>
        )}

        {/* Search trigger — opens CommandPalette */}
        <button
          onClick={() => openCommandPalette(true)}
          className={clsx(
            'flex items-center gap-2 h-8 px-3 rounded-[8px]',
            'bg-[rgba(60,60,67,0.06)] hover:bg-[rgba(60,60,67,0.10)]',
            'text-[13px] text-label-2 transition-colors'
          )}
          aria-label="Search (⌘K)"
        >
          <Search size={14} />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline text-[10px] bg-[rgba(60,60,67,0.08)] px-1.5 py-0.5 rounded text-label-3">
            ⌘K
          </kbd>
        </button>

        {/* Morning brief (Phase 81) */}
        <BriefBell />

        {/* Notification Center */}
        <NotificationCenter />
      </div>
    </header>
  );
}
