'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import { cn, getInitials } from '@/lib/utils';
import type { UserRole } from '@/types';
import {
  LayoutDashboard,
  Columns3,
  Users,
  FileText,
  TrendingUp,
  Bot,
  Phone,
  CheckSquare,
  Inbox,
  Megaphone,
  RadioTower,
  Handshake,
  Building2,
  BarChart3,
  DollarSign,
  ClipboardCheck,
  Users2,
  Settings,
  CreditCard,
  LogOut,
  Building,
  Calculator,
  LineChart,
  Landmark,
  PieChart,
  HeartPulse,
  ShieldCheck,
  Target,
  Calendar,
  Search,
  Video,
  Star,
  ClipboardList,
  Layers,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  adminOnly?: boolean;
  processorOnly?: boolean;
  hideForProcessor?: boolean;
  highlight?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { href: '/today', label: 'Today', icon: Target, highlight: true, hideForProcessor: true },
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hideForProcessor: true },
      { href: '/processor', label: 'My Files', icon: Layers, processorOnly: true, highlight: true },
      { href: '/processor/organizations', label: 'My Organizations', icon: Building2, processorOnly: true },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      { href: '/pipeline', label: 'Pipeline', icon: Columns3, hideForProcessor: true },
      { href: '/leads', label: 'Leads', icon: Users, hideForProcessor: true },
      { href: '/inbox', label: 'Inbox', icon: Inbox },
      { href: '/processing', label: 'Processing', icon: ClipboardList },
      { href: '/applications', label: 'Applications', icon: FileText, hideForProcessor: true },
      { href: '/calendar', label: 'Pipeline Calendar', icon: Calendar, hideForProcessor: true },
      { href: '/credit-repair', label: 'Credit Repair', icon: HeartPulse, hideForProcessor: true },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/pricing', label: 'Pricing Engine', icon: Calculator },
      { href: '/dscr', label: 'DSCR / Non-QM', icon: LineChart },
      { href: '/commercial', label: 'Commercial', icon: Building2 },
      { href: '/rates', label: 'Rates', icon: TrendingUp },
      { href: '/ai-coach', label: 'AI Coach', icon: Bot },
      { href: '/dialer', label: 'Dialer', icon: Phone },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/video-messages', label: 'Video Messages', icon: Video },
      { href: '/templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    label: 'Outreach',
    items: [
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/broadcast', label: 'Broadcast', icon: RadioTower },
    ],
  },
  {
    label: 'Network',
    items: [
      { href: '/lenders', label: 'Lender Marketplace', icon: Landmark },
      { href: '/partners', label: 'Partners', icon: Handshake },
      { href: '/brokers', label: 'Brokers', icon: Building2 },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/revenue', label: 'Revenue Intelligence', icon: PieChart },
      { href: '/commissions', label: 'Commissions', icon: DollarSign },
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/post-close', label: 'Post-Close', icon: ClipboardCheck },
      { href: '/reviews', label: 'Reviews & NPS', icon: Star },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/nmls', label: 'NMLS Compliance', icon: ShieldCheck, adminOnly: true },
      { href: '/team', label: 'Team', icon: Users2, adminOnly: true },
      { href: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
      { href: '/settings/billing', label: 'Billing', icon: CreditCard, adminOnly: true },
    ],
  },
];

interface SidebarProps {
  userRole?: string;
  orgName?: string;
}

export function Sidebar({ userRole, orgName }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();

  const isAdmin = userRole === 'admin' || userRole === 'branch_manager';
  const isProcessor = userRole === 'processor';
  const fullName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
    : '';
  const initials = fullName ? getInitials(fullName) : '?';

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[220px] z-40 flex flex-col glass-sidebar border-r border-black/[0.06]"
      style={{ width: '220px' }}
    >
      {/* Wordmark */}
      <div className="h-[44px] flex items-center px-4 border-b border-black/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-6 h-6 rounded-lg bg-navy flex items-center justify-center flex-shrink-0">
            <Building className="w-3.5 h-3.5 text-gold" />
          </div>
          <span
            className="text-[15px] font-semibold text-navy tracking-tight"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Orignest
          </span>
        </div>
        {/* ⌘K hint */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true });
            window.dispatchEvent(event);
          }}
          className="flex items-center gap-1 h-6 px-1.5 rounded-md bg-[rgba(60,60,67,0.06)] hover:bg-[rgba(60,60,67,0.10)] transition-colors"
          title="Search (⌘K)"
        >
          <Search className="w-3 h-3 text-[#AEAEB2]" />
          <kbd className="text-[9px] font-mono text-[#AEAEB2]">⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.processorOnly && !isProcessor) return false;
            if (item.hideForProcessor && isProcessor) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <div className="px-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-label2">
                  {group.label}
                </span>
              </div>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-[7px] rounded-[7px] text-[13px] font-medium transition-colors',
                          active
                            ? 'bg-black/[0.07] text-navy'
                            : 'text-label2 hover:bg-black/[0.04] hover:text-navy'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'w-4 h-4 flex-shrink-0',
                            active ? 'text-blue' : 'text-label3'
                          )}
                        />
                        {item.label}
                        {item.badge && (
                          <span className="ml-auto bg-blue text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User chip */}
      <div className="border-t border-black/[0.06] p-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 p-2 rounded-[7px] hover:bg-black/[0.04] transition-colors group">
          <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center text-[11px] font-semibold text-gold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-medium text-navy truncate">{fullName || 'My Account'}</div>
            <div className="text-[11px] text-label3 truncate capitalize">{userRole ?? 'Loan Officer'}</div>
          </div>
          <button
            onClick={() => signOut()}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-black/[0.06]"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-label2" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
