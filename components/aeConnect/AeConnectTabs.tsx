'use client';

// Phase 89 — tab bar for the AE Connect section. [Directory] (Phase 89) + [Forum]
// (Phase 89b). The Forum tab shows a badge of unread responses since last visit;
// the badge fetch degrades gracefully if the forum endpoint isn't present.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BookUser, MessagesSquare } from 'lucide-react';

export function AeConnectTabs() {
  const pathname = usePathname();
  const [forumBadge, setForumBadge] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch('/api/ae-forum/unread')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setForumBadge(d.unread ?? 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [pathname]);

  const tabs = [
    { href: '/ae-connect', label: 'Directory', icon: BookUser, badge: 0 },
    { href: '/ae-connect/forum', label: 'Forum', icon: MessagesSquare, badge: forumBadge },
  ];

  return (
    <div className="flex items-center gap-1 mb-5 border-b border-[var(--c-border)]">
      {tabs.map((t) => {
        const active = t.href === '/ae-connect' ? pathname === '/ae-connect' : pathname.startsWith(t.href);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${active ? 'border-[var(--c-gold)] text-[var(--c-gold-deep)]' : 'border-transparent text-[var(--c-label2)] hover:text-[var(--c-text)]'}`}
          >
            <Icon size={14} />
            {t.label}
            {t.badge > 0 && (
              <span className="ml-0.5 text-[10px] font-bold bg-[var(--c-gold)] text-white rounded-full px-1.5 py-0.5 leading-none">{t.badge}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
