'use client';

import { clsx } from 'clsx';
import { UserButton, useOrganization } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GitBranch,
  Users,
  FileText,
  TrendingUp,
  Megaphone,
  Network,
  BarChart3,
  Settings,
  Inbox,
  Bot,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  adminOnly?: boolean;
  managerOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: <LayoutDashboard size={16} />,
      },
      {
        label: 'Inbox',
        href: '/inbox',
        icon: <Inbox size={16} />,
      },
    ],
  },
  {
    label: 'Pipeline',
    items: [
      {
        label: 'Pipeline',
        href: '/pipeline',
        icon: <GitBranch size={16} />,
      },
      {
        label: 'Leads',
        href: '/leads',
        icon: <Users size={16} />,
      },
      {
        label: 'Applications',
        href: '/applications',
        icon: <FileText size={16} />,
      },
    ],
  },
  {
    label: 'Marketing',
    items: [
      {
        label: 'Campaigns',
        href: '/campaigns',
        icon: <Megaphone size={16} />,
      },
      {
        label: 'Rates',
        href: '/rates',
        icon: <TrendingUp size={16} />,
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label: 'Reports',
        href: '/reports',
        icon: <BarChart3 size={16} />,
        managerOnly: true,
      },
      {
        label: 'AI Coach',
        href: '/ai-coach',
        icon: <Bot size={16} />,
      },
    ],
  },
  {
    label: 'Network',
    items: [
      {
        label: 'Partners',
        href: '/partners',
        icon: <Network size={16} />,
      },
      {
        label: 'Team',
        href: '/team',
        icon: <Users size={16} />,
        managerOnly: true,
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        label: 'Settings',
        href: '/settings',
        icon: <Settings size={16} />,
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        label: 'Admin Panel',
        href: '/admin',
        icon: <ShieldCheck size={16} />,
        adminOnly: true,
      },
    ],
  },
];

interface SidebarProps {
  userRole?: string;
  orgName?: string;
}

export function Sidebar({ userRole, orgName: orgNameProp }: SidebarProps) {
  const pathname = usePathname();
  const { organization } = useOrganization();

  const isActive = (href: string) => {
    const full = href;
    if (full === '/dashboard') return pathname === full;
    return pathname.startsWith(full);
  };

  const canSee = (item: NavItem): boolean => {
    if (item.adminOnly && userRole !== 'admin') return false;
    if (item.managerOnly && userRole !== 'admin' && userRole !== 'branch_manager') return false;
    return true;
  };

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 bottom-0 z-40',
        'w-[220px] flex flex-col',
        'bg-[rgba(255,255,255,0.72)] backdrop-blur-[28px]',
        'border-r border-[rgba(60,60,67,0.12)]'
      )}
    >
      {/* Organization header */}
      <div className="px-4 pt-5 pb-3 border-b border-[rgba(60,60,67,0.08)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-navy flex items-center justify-center flex-shrink-0">
            <span className="text-gold text-[11px] font-bold">C</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-black truncate leading-tight">
              {orgNameProp ?? organization?.name ?? 'Conduit CRM'}
            </p>
            <p className="text-[11px] text-label-2 leading-tight">Mortgage CRM</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter(canSee);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="px-2 mb-1 text-[10px] font-semibold text-label-3 uppercase tracking-widest">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={clsx(
                          'flex items-center gap-2.5 px-2.5 py-2 rounded-[8px]',
                          'text-[13px] font-medium transition-colors duration-100',
                          active
                            ? 'bg-blue text-white shadow-sm'
                            : 'text-black hover:bg-[rgba(60,60,67,0.06)] active:bg-[rgba(60,60,67,0.10)]'
                        )}
                      >
                        <span className={clsx(active ? 'text-white/90' : 'text-label-2')}>
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            className={clsx(
                              'flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                              'flex items-center justify-center',
                              active
                                ? 'bg-white/20 text-white'
                                : 'bg-red text-white'
                            )}
                          >
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

      {/* User footer */}
      <div className="px-3 py-3 border-t border-[rgba(60,60,67,0.08)]">
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'w-8 h-8',
              userButtonPopoverCard: 'shadow-[0_8px_32px_rgba(0,0,0,0.16)]',
            },
          }}
          showName
        />
      </div>
    </aside>
  );
}
