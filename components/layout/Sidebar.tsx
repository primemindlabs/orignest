'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  GitBranch,
  Calendar,
  CheckSquare,
  FolderOpen,
  Megaphone,
  BarChart3,
  Settings,
  LogOut,
  Bot,
  FileText,
  ClipboardList,
  DollarSign,
  ShieldCheck,
  Users2,
  CreditCard,
  TrendingUp,
  Phone,
  Handshake,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  adminOnly?: boolean;
  processorOnly?: boolean;
  hideForProcessor?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', label: 'Command Center', icon: LayoutDashboard },
      { href: '/inbox', label: 'Conversations', icon: MessageSquare, hideForProcessor: false },
      { href: '/leads', label: 'Leads', icon: Users, hideForProcessor: true },
      { href: '/pipeline', label: 'Pipeline', icon: GitBranch, hideForProcessor: true },
      { href: '/calendar', label: 'Calendar', icon: Calendar },
      { href: '/tasks', label: 'Tasks', icon: CheckSquare },
      { href: '/applications', label: 'Documents', icon: FolderOpen },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/ai-coach', label: 'AI Coach', icon: Bot },
      { href: '/campaigns', label: 'Marketing', icon: Megaphone },
      { href: '/dialer', label: 'Dialer', icon: Phone },
      { href: '/rates', label: 'Rates', icon: TrendingUp },
      { href: '/partners', label: 'Partners', icon: Handshake },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/commissions', label: 'Commissions', icon: DollarSign },
      { href: '/nmls', label: 'Compliance', icon: ShieldCheck, adminOnly: true },
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
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] z-40 flex flex-col bg-white border-r border-gray-100">
      {/* Logo */}
      <div className="h-[60px] flex items-center px-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L11 7.5H17L12.5 11L14.5 16.5L9 13L3.5 16.5L5.5 11L1 7.5H7L9 2Z" fill="white" stroke="white" strokeWidth="0.3"/>
              <circle cx="14.5" cy="3.5" r="2" fill="#2563EB"/>
            </svg>
          </div>
          <div>
            <div className="text-[14px] font-bold text-gray-900 leading-tight">
              Ashley <span className="text-blue-600">AI</span>
            </div>
            <div className="text-[10px] text-gray-400 leading-tight">Your AI Mortgage Assistant</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter((item) => {
            if (item.adminOnly && !isAdmin) return false;
            if (item.processorOnly && !isProcessor) return false;
            if (item.hideForProcessor && isProcessor) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          return (
            <div key={gi}>
              {group.label && (
                <div className="px-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                    {group.label}
                  </span>
                </div>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors',
                          active
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        )}
                      >
                        <item.icon
                          className={cn(
                            'w-4 h-4 flex-shrink-0',
                            active ? 'text-blue-600' : 'text-gray-400'
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.badge !== undefined && (
                          <span className={cn(
                            'text-[11px] font-semibold rounded-full px-1.5 py-0.5 leading-none min-w-[20px] text-center',
                            active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                          )}>
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

      {/* Ashley works 24/7 widget */}
      <div className="mx-3 mb-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">✨</span>
          <span className="text-[12px] font-semibold text-blue-800">Ashley works 24/7</span>
        </div>
        <p className="text-[11px] text-blue-600 leading-relaxed">Never misses a lead. Never forgets to follow up.</p>
        <Link href="/ai-coach" className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1">
          Learn more →
        </Link>
      </div>

      {/* User chip */}
      <div className="border-t border-gray-100 p-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-gray-900 truncate">{fullName || 'My Account'}</div>
            <div className="text-[11px] text-gray-400 truncate capitalize">{orgName ?? userRole ?? 'Loan Officer'}</div>
          </div>
          <button
            onClick={() => signOut()}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-gray-100"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
