'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { isGroupVisible } from '@/lib/navigation/roles';
import {
  LayoutDashboard, GitBranch, Repeat, Megaphone, Sparkles, BarChart3, ShieldCheck, Settings,
  ChevronDown, PanelLeftClose, PanelLeftOpen, LogOut,
} from 'lucide-react';

/**
 * Phase 29.1 — Global sidebar consolidation. 8 top-level groups with inner-nav
 * accordion. Nothing is buried more than 2 levels deep. State (collapsed +
 * expanded groups) persists to localStorage; auto-collapses on narrow screens.
 * Gold left border marks the active group; no blue anywhere.
 */
interface NavItem { href: string; label: string }
interface NavGroup { key: string; label: string; icon: React.ElementType; href?: string; items?: NavItem[]; adminOnly?: boolean }

const NAV: NavGroup[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  {
    key: 'pipeline', label: 'Pipeline', icon: GitBranch, items: [
      { href: '/pipeline', label: 'Pipeline Board' },
      { href: '/leads', label: 'Leads' },
      { href: '/my-tasks', label: 'My Queue' },
      { href: '/credit-alerts', label: 'Credit Alerts' },
      { href: '/my-book', label: 'My Book' },
      { href: '/inbox', label: 'Conversations' },
      { href: '/team-chat', label: 'Team Chat' },
      { href: '/voicemails', label: 'Voicemails' },
      { href: '/calendar', label: 'Calendar' },
      { href: '/applications', label: 'File Room' },
      { href: '/dscr-calculator', label: 'DSCR Calculator' },
    ],
  },
  {
    key: 'relationships', label: 'Relationships', icon: Repeat, items: [
      { href: '/relationships', label: 'Borrowers' },
      { href: '/partners', label: 'Realtors & Partners' },
      { href: '/realtors', label: 'Realtor Intelligence' },
      { href: '/discover', label: 'Discover Realtors' },
    ],
  },
  {
    key: 'marketing', label: 'Marketing', icon: Megaphone, items: [
      // Phase 34: Campaigns is the primary entry; Rate Drop + Market Updates are
      // now campaign types inside it (their pages remain, just not standalone nav).
      { href: '/campaigns/manager', label: 'Campaigns' },
      { href: '/social', label: 'Social Media' },
      { href: '/co-marketing', label: 'Co-Marketing' },
      { href: '/co-marketing/listings', label: 'Listings' },
      { href: '/ads', label: 'Ad Center' },
      { href: '/dialer/power', label: 'Power Dialer' },
    ],
  },
  {
    key: 'tools', label: 'Tools', icon: Sparkles, items: [
      { href: '/ai-coach', label: 'AI Coach' },
      { href: '/pricing', label: 'Rate & Pricing' },
      { href: '/dialer/power', label: 'Power Dialer' },
      { href: '/pre-approval', label: 'Pre-Approval' },
      { href: '/scenarios', label: 'Scenario AI' },
      { href: '/income', label: 'Income Calculators' },
      { href: '/dscr', label: 'DSCR / Non-QM' },
      { href: '/training', label: 'Training Center' },
      { href: '/training/ask', label: 'Ask Ashley' },
      { href: '/refi-watch', label: 'Refi Watch' },
      { href: '/equity', label: 'Equity Tracker' },
    ],
  },
  {
    key: 'analytics', label: 'Insights', icon: BarChart3, items: [
      { href: '/reports', label: 'Reports' },
      { href: '/referral-attribution', label: 'Attribution' },
      { href: '/commissions', label: 'Commissions' },
      { href: '/buyer-referrals', label: 'Buyer Referrals' },
      { href: '/investors', label: 'Investors' },
      { href: '/reviews', label: 'Reviews' },
      { href: '/leaderboard', label: 'Leaderboard' },
      { href: '/scorecard', label: 'My Scorecard' },
    ],
  },
  {
    key: 'management', label: 'Management', icon: BarChart3, adminOnly: true, items: [
      { href: '/branch', label: 'Branch Dashboard' },
      { href: '/branch/team', label: 'Team Performance' },
      { href: '/ae-book', label: 'AE Book of Business' },
      { href: '/ae-management', label: 'Wholesale Team' },
    ],
  },
  {
    key: 'compliance', label: 'Compliance', icon: ShieldCheck, adminOnly: true, items: [
      { href: '/settings/compliance', label: 'Compliance & Templates' },
      { href: '/compliance/dnc', label: 'Do Not Call List' },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: Settings, adminOnly: true, items: [
      { href: '/settings', label: 'Settings' },
      { href: '/team', label: 'Team' },
      { href: '/settings/billing', label: 'Billing' },
    ],
  },
];

const STORAGE_KEY = 'ashley-iq-sidebar-state';

interface SidebarProps { userRole?: string; orgName?: string }

export function Sidebar({ userRole, orgName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();

  // Phase 57.1 — role-filtered nav. Generalists (lo / branch_manager / admin) keep
  // the full nav exactly as before; specialized roles get a tailored subset.
  const groups = NAV.filter((g) => isGroupVisible(g.key, g.adminOnly, userRole));

  // ── Active group via longest-prefix match across all items ──────────────────
  function prefixLen(href: string): number {
    if (href === '/dashboard') return pathname === href ? href.length : -1;
    return pathname === href || pathname.startsWith(href + '/') ? href.length : -1;
  }
  let activeGroup = '';
  let activeHref = '';
  let best = 0;
  for (const g of groups) {
    for (const it of g.href ? [{ href: g.href, label: g.label }] : g.items ?? []) {
      const l = prefixLen(it.href);
      if (l > best) { best = l; activeGroup = g.key; activeHref = it.href; }
    }
  }

  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate persisted state; default collapsed on narrow screens.
  useEffect(() => {
    let saved: { collapsed?: boolean; expanded?: string[] } | null = null;
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) saved = JSON.parse(raw); } catch { /* ignore */ }
    const initialCollapsed = saved?.collapsed ?? (typeof window !== 'undefined' && window.innerWidth < 1280);
    setCollapsed(initialCollapsed);
    setExpanded(saved?.expanded ?? (activeGroup ? [activeGroup] : []));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the active group expanded as the route changes.
  useEffect(() => {
    if (activeGroup) setExpanded((e) => (e.includes(activeGroup) ? e : [...e, activeGroup]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  // Drive content reflow + persist.
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? '64px' : '220px');
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ collapsed, expanded })); } catch { /* ignore */ }
  }, [collapsed, expanded, hydrated]);

  function toggleGroup(key: string) {
    setExpanded((e) => (e.includes(key) ? e.filter((k) => k !== key) : [...e, key]));
  }

  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
  const initials = fullName ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <aside
      className={cn('fixed left-0 top-0 bottom-0 z-40 flex flex-col bg-white border-r border-gray-100 transition-[width] duration-150', collapsed ? 'w-[64px]' : 'w-[220px]')}
    >
      {/* Logo + collapse toggle */}
      <div className="h-[60px] flex items-center justify-between px-3 border-b border-gray-100 flex-shrink-0">
        {!collapsed && <Logo size={32} />}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
        {groups.map((g) => {
          const Icon = g.icon;
          const isActive = activeGroup === g.key;
          const isExpanded = expanded.includes(g.key);

          // Flat item (Dashboard) or collapsed mode → single clickable row.
          if (g.href || collapsed) {
            const target = g.href ?? g.items?.[0]?.href ?? '#';
            return (
              <Link
                key={g.key}
                href={target}
                title={g.label}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors border-l-[3px]',
                  collapsed && 'justify-center px-0',
                  isActive ? 'bg-gold-50 text-gold-700 border-gold-500' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-gold-600' : 'text-gray-400')} />
                {!collapsed && <span className="flex-1">{g.label}</span>}
              </Link>
            );
          }

          // Group with inner-nav accordion.
          return (
            <div key={g.key}>
              <button
                onClick={() => toggleGroup(g.key)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors border-l-[3px]',
                  isActive ? 'bg-gold-50 text-gold-700 border-gold-500' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-transparent'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-gold-600' : 'text-gray-400')} />
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
              </button>
              {isExpanded && (
                <ul className="mt-0.5 mb-1 ml-[26px] pl-2.5 border-l border-gray-100 space-y-0.5">
                  {(g.items ?? []).map((it) => {
                    const subActive = activeHref === it.href;
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          className={cn(
                            'block px-2.5 py-1.5 rounded-lg text-[12px] transition-colors',
                            subActive ? 'bg-gold-50 text-gold-700 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                          )}
                        >
                          {it.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Ashley works 24/7 widget (hidden when collapsed) */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-xl bg-gold-50 border border-gold-100">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-gold-600" strokeWidth={1.75} />
            <span className="text-[12px] font-semibold text-gold-800">Ashley works 24/7</span>
          </div>
          <p className="text-[11px] text-gold-600 leading-relaxed">Never misses a lead. Never forgets to follow up.</p>
          <Link href="/ai-coach" className="text-[11px] font-semibold text-gold-600 hover:text-gold-800 mt-2 flex items-center gap-1">Learn more →</Link>
        </div>
      )}

      {/* User chip */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <div className={cn('flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors group', collapsed && 'justify-center p-1')}>
          <div className="w-8 h-8 rounded-full bg-gold-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">{initials}</div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-gray-900 truncate">{fullName || 'My Account'}</div>
                <div className="text-[11px] text-gray-400 truncate capitalize">{orgName ?? userRole ?? 'Loan Officer'}</div>
              </div>
              <button onClick={() => signOut()} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-gray-100" title="Sign out">
                <LogOut className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
