'use client';

/**
 * Phase 139 — shared link-based tab bar so several full-page tools read as tabs
 * inside one hub (per the nav reorg). The active tab is matched by pathname.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface HubTab { href: string; label: string }

export function HubTabs({ tabs }: { tabs: HubTab[] }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-border mb-5 overflow-x-auto -mx-1 px-1">
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/');
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'px-3.5 py-2 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              active ? 'border-gold-500 text-gold-700' : 'border-transparent text-label-2 hover:text-label'
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

// ── Hub tab sets ──
export const BORROWER_HUB_TABS: HubTab[] = [
  { href: '/relationships', label: 'Borrowers' },
  { href: '/goldmine', label: 'Database Goldmine' },
  { href: '/equity-loop', label: 'Equity Loop' },
  { href: '/credit-alerts', label: 'Credit Alerts' },
  { href: '/credit-repair', label: 'Credit Repair' },
  { href: '/rate-locks', label: 'Rate Locks' },
];

export const PRICING_TABS: HubTab[] = [
  { href: '/pricing', label: 'Pricing Engine' },
  { href: '/rate-sheets', label: 'Rate Sheets' },
];

export const LEADS_TABS: HubTab[] = [
  { href: '/leads', label: 'Leads' },
  { href: '/speed-to-lead', label: 'Respond Now' },
];

export function BorrowerHubTabs() { return <HubTabs tabs={BORROWER_HUB_TABS} />; }
export function PricingTabs() { return <HubTabs tabs={PRICING_TABS} />; }
export function LeadsTabs() { return <HubTabs tabs={LEADS_TABS} />; }
