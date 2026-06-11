'use client';

// Phase 81 — nav control for the morning brief. Sun icon + red badge showing the count
// of undismissed urgent items; links to the dashboard where the full brief lives.

import Link from 'next/link';
import { IconSun } from '@tabler/icons-react';
import { useUnreadBriefCount } from '@/hooks/useUnreadBriefCount';

export function BriefBell() {
  const count = useUnreadBriefCount();

  return (
    <Link
      href="/dashboard"
      aria-label={count > 0 ? `${count} urgent priorities in your morning brief` : 'Morning brief'}
      className="relative h-8 w-8 grid place-items-center rounded-[8px] text-[var(--c-label2)] hover:text-[var(--c-text)] hover:bg-[rgba(60,60,67,0.06)] transition-colors"
    >
      <IconSun size={17} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 grid place-items-center rounded-full bg-[var(--c-danger)] text-white text-[9px] font-semibold leading-none">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
