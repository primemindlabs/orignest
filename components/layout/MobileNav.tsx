'use client';

import { clsx } from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GitBranch,
  Users,
  Megaphone,
  Settings,
} from 'lucide-react';

const MOBILE_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Pipeline', href: '/pipeline', icon: <GitBranch size={20} /> },
  { label: 'Leads', href: '/leads', icon: <Users size={20} /> },
  { label: 'Campaigns', href: '/campaigns', icon: <Megaphone size={20} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={20} /> },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className={clsx(
        'fixed bottom-0 left-0 right-0 z-40 sm:hidden',
        'h-[60px] flex items-stretch',
        'bg-[rgba(255,255,255,0.92)] backdrop-blur-[28px]',
        'border-t border-[rgba(60,60,67,0.12)]',
        'pb-safe' // iOS safe area
      )}
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              'flex-1 flex flex-col items-center justify-center gap-1 pt-2',
              'text-[10px] font-medium transition-colors',
              active ? 'text-blue' : 'text-label-3'
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
