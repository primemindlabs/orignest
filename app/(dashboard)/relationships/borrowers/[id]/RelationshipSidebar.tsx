'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, TrendingUp, History, Cake, Activity } from 'lucide-react';

interface Section { label: string; href: string; icon: React.ElementType; sub?: { label: string; href: string }[] }

const NAV: Section[] = [
  { label: 'Overview', href: '', icon: LayoutDashboard },
  { label: 'Portfolio', href: '/portfolio', icon: Building2 },
  {
    label: 'Property Intelligence', href: '/property-intelligence', icon: TrendingUp,
    sub: [
      { label: 'Refi Watch', href: '/property-intelligence/refi-watch' },
      { label: 'Equity Tracker', href: '/property-intelligence/equity-tracker' },
      { label: 'Market Alerts', href: '/property-intelligence/market-alerts' },
    ],
  },
  { label: 'Loan History', href: '/loan-history', icon: History },
  { label: 'Annual Review', href: '/annual-review', icon: Cake },
  { label: 'Activity', href: '/activity', icon: Activity },
];

export function RelationshipSidebar({ recordId }: { recordId: string }) {
  const pathname = usePathname();
  const base = `/relationships/borrowers/${recordId}`;

  return (
    <aside className="flex-shrink-0 w-[200px] border-r border-[var(--c-border)] bg-[var(--c-surface)] overflow-y-auto py-3">
      <nav className="px-2.5 space-y-0.5">
        {NAV.map((s) => {
          const href = base + s.href;
          const active = s.href === '' ? pathname === base : pathname.startsWith(href);
          const Icon = s.icon;
          const subs = s.sub ?? [];
          return (
            <div key={s.label}>
              <Link href={href} className={`flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13px] font-medium transition-colors border-l-[3px] ${active ? 'bg-[var(--c-gold-light)] text-[var(--c-gold-deep)] border-[var(--c-gold)]' : 'text-[var(--c-label2)] hover:bg-[var(--c-fill)] hover:text-[var(--c-text)] border-transparent'}`}>
                <Icon size={15} className={active ? 'text-[var(--c-gold)]' : 'text-[var(--c-label3)]'} />
                <span className="flex-1">{s.label}</span>
              </Link>
              {active && subs.length > 0 && (
                <div className="ml-[26px] mt-0.5 mb-1 space-y-0.5 border-l border-[var(--c-border)] pl-2.5">
                  {subs.map((sub) => {
                    const sh = base + sub.href;
                    const sa = pathname === sh;
                    return <Link key={sub.href} href={sh} className={`block px-2.5 py-1.5 rounded-[8px] text-[12px] ${sa ? 'text-[var(--c-gold-deep)] font-medium bg-[var(--c-gold-light)]' : 'text-[var(--c-label2)] hover:text-[var(--c-text)] hover:bg-[var(--c-fill)]'}`}>{sub.label}</Link>;
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
