'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import { isGroupVisible } from '@/lib/navigation/roles';
import { useNavDrawer } from '@/components/layout/NavDrawerContext';
import {
  LayoutDashboard, Sun, GitBranch, Users, MessagesSquare, Palette, Percent, Sparkles, BarChart3, ShieldCheck, Settings,
  ChevronDown, PanelLeftClose, PanelLeftOpen, LogOut, X, Building2,
} from 'lucide-react';

/**
 * Phase 29.1 — Global sidebar consolidation. 8 top-level groups with inner-nav
 * accordion. Nothing is buried more than 2 levels deep. State (collapsed +
 * expanded groups) persists to localStorage; auto-collapses on narrow screens.
 * Gold left border marks the active group; no blue anywhere.
 */
interface NavItem { href: string; label: string }
interface NavGroup { key: string; label: string; icon: React.ElementType; href?: string; items?: NavItem[]; adminOnly?: boolean; directLenderOnly?: boolean }

const NAV: NavGroup[] = [
  { key: 'today', label: 'Today', icon: Sun, href: '/today' },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  {
    key: 'pipeline', label: 'Pipeline', icon: GitBranch, items: [
      { href: '/pipeline', label: 'Loans' },
      { href: '/leads', label: 'Leads' },
      { href: '/inbound', label: 'Inbound' },
      { href: '/my-tasks', label: 'To-Do' },
    ],
  },
  {
    key: 'contacts', label: 'Contacts', icon: Users, items: [
      { href: '/relationships', label: 'Borrowers' },
      { href: '/realtors', label: 'Realtors' },
      { href: '/discover', label: 'Realtor Discovery' },
      { href: '/lenders', label: 'Lenders & AEs' },
    ],
  },
  {
    key: 'communicate', label: 'Communicate', icon: MessagesSquare, items: [
      { href: '/inbox', label: 'Inbox' },
      { href: '/campaigns/manager', label: 'Campaigns' },
      { href: '/dialer', label: 'Dialer' },
      { href: '/calendar', label: 'Calendar' },
    ],
  },
  {
    key: 'create', label: 'Create', icon: Palette, items: [
      { href: '/marketing/content-studio', label: 'Content Studio' },
      { href: '/ads', label: 'Ads & Social' },
      { href: '/co-marketing', label: 'Co-Marketing' },
    ],
  },
  {
    key: 'analyze', label: 'Analyze', icon: Percent, items: [
      { href: '/pricing', label: 'Pricing Engine' },
      { href: '/scenarios', label: 'Scenario AI' },
      { href: '/income', label: 'Income Calculators' },
      { href: '/dscr', label: 'Non-QM & Commercial' },
      { href: '/reports', label: 'Reports' },
    ],
  },
  {
    key: 'manage', label: 'Manage', icon: Settings, items: [
      { href: '/training', label: 'Training' },
      { href: '/team', label: 'Team' },
      { href: '/commissions', label: 'Comp Calculator' },
      { href: '/ai-coach', label: 'AI Coach' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  // ── Admin / Branch Manager only ──
  {
    key: 'management', label: 'Management', icon: BarChart3, adminOnly: true, items: [
      { href: '/branch', label: 'Branch Dashboard' },
      { href: '/branch/team', label: 'Team Performance' },
    ],
  },
  // ── Direct-lender only (AE / wholesale vertical) ──
  {
    key: 'wholesale', label: 'Wholesale', icon: Building2, directLenderOnly: true, items: [
      { href: '/ae-book', label: 'AE Book of Business' },
      { href: '/ae-management', label: 'Wholesale Team' },
    ],
  },
  {
    key: 'compliance', label: 'Compliance', icon: ShieldCheck, adminOnly: true, items: [
      { href: '/compliance/shield', label: 'Compliance Shield' },
      { href: '/settings/compliance', label: 'Compliance & Templates' },
      { href: '/compliance/tcpa', label: 'TCPA & Comm Center' },
      { href: '/compliance/dnc', label: 'Do Not Call List' },
    ],
  },
];

const COOKIE_KEY = 'ashley_sidebar';

function persistSidebar(state: { collapsed: boolean; expanded: string[] }) {
  try {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

interface SidebarProps { userRole?: string; orgName?: string; channel?: string; initialCollapsed?: boolean; initialExpanded?: string[] }

export function Sidebar({ userRole, orgName, channel, initialCollapsed, initialExpanded }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { open: mobileOpen, setOpen: setMobileOpen } = useNavDrawer();

  // Phase 57.1 — role-filtered nav. Generalists (lo / branch_manager / admin) keep
  // the full nav exactly as before; specialized roles get a tailored subset.
  const isDirectLender = channel === 'direct_lender' || channel === 'lender';
  const groups = NAV.filter((g) => {
    if (g.directLenderOnly && !isDirectLender) return false;
    return isGroupVisible(g.key, g.adminOnly, userRole);
  });

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

  // Seed from server-provided (cookie) state so the first client render matches SSR
  // exactly — no post-hydration snap. Falls back to opening just the active group.
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false);
  const [expanded, setExpanded] = useState<string[]>(initialExpanded ?? (activeGroup ? [activeGroup] : []));

  // Keep the active group expanded as the route changes.
  useEffect(() => {
    if (activeGroup) setExpanded((e) => (e.includes(activeGroup) ? e : [...e, activeGroup]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  // Drive content reflow (same element the SSR width var lives on) + persist to cookie.
  useEffect(() => {
    document.getElementById('app-shell')?.style.setProperty('--sidebar-w', collapsed ? '64px' : '220px');
    persistSidebar({ collapsed, expanded });
  }, [collapsed, expanded]);

  function toggleGroup(key: string) {
    setExpanded((e) => (e.includes(key) ? e.filter((k) => k !== key) : [...e, key]));
  }

  const fullName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '';
  const initials = fullName ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <>
    {/* Mobile off-canvas drawer (full nav). Desktop uses the fixed aside below. */}
    {mobileOpen && (
      <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
        <div className="absolute left-0 top-0 bottom-0 w-[260px] bg-white border-r border-gray-100 flex flex-col">
          <div className="h-[60px] flex items-center justify-between px-4 border-b border-gray-100 flex-shrink-0">
            <Logo size={32} />
            <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50" aria-label="Close menu"><X className="w-4 h-4" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-2">
            {groups.map((g) => {
              const Icon = g.icon;
              const target = g.href ?? g.items?.[0]?.href ?? '#';
              if (g.href) {
                return (
                  <Link key={g.key} href={target} onClick={() => setMobileOpen(false)} className={cn('flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium', activeGroup === g.key ? 'bg-gold-50 text-gold-700' : 'text-gray-700 hover:bg-gray-50')}>
                    <Icon className="w-4 h-4 text-gray-400" /> {g.label}
                  </Link>
                );
              }
              return (
                <div key={g.key}>
                  <div className="flex items-center gap-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400"><Icon className="w-3.5 h-3.5" /> {g.label}</div>
                  <ul className="mt-0.5">
                    {(g.items ?? []).map((it) => (
                      <li key={it.href}>
                        <Link href={it.href} onClick={() => setMobileOpen(false)} className={cn('block px-3 py-1.5 rounded-lg text-[13px]', activeHref === it.href ? 'bg-gold-50 text-gold-700 font-medium' : 'text-gray-600 hover:bg-gray-50')}>{it.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    )}

    <aside
      className={cn('fixed left-0 top-0 bottom-0 z-40 hidden lg:flex flex-col bg-white border-r border-gray-100 transition-[width] duration-150', collapsed ? 'w-[64px]' : 'w-[220px]')}
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
    </>
  );
}

export default Sidebar;
