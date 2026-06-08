'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  AlertTriangle,
  MessageSquare,
  CheckSquare,
  FileText,
  Info,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

type NotifSection = 'urgent' | 'messages' | 'tasks' | 'documents' | 'info';

interface NotificationItem {
  id: string;
  section: NotifSection;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  time: string;
  href: string;
  read: boolean;
}

const SECTION_CONFIG: Record<
  NotifSection,
  { label: string; icon: React.ReactNode; color: string }
> = {
  urgent: { label: 'Urgent', icon: <AlertTriangle size={12} />, color: 'text-red' },
  messages: { label: 'Messages', icon: <MessageSquare size={12} />, color: 'text-blue' },
  tasks: { label: 'Tasks', icon: <CheckSquare size={12} />, color: 'text-orange' },
  documents: { label: 'Documents', icon: <FileText size={12} />, color: 'text-[#C9A95C]' },
  info: { label: 'Info', icon: <Info size={12} />, color: 'text-[#6C6C70]' },
};

interface NotifData {
  items: NotificationItem[];
  totalUnread: number;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotifData>({ items: [], totalUnread: 0 });
  const [loading, setLoading] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json() as NotifData;
        setData(json);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markRead(id: string) {
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setData((prev) => ({
        ...prev,
        items: prev.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        totalUnread: Math.max(0, prev.totalUnread - 1),
      }));
    } catch {
      // silently fail
    }
  }

  // Group items by section
  const grouped: Partial<Record<NotifSection, NotificationItem[]>> = {};
  for (const item of data.items) {
    if (!grouped[item.section]) grouped[item.section] = [];
    grouped[item.section]!.push(item);
  }

  const sections: NotifSection[] = ['urgent', 'messages', 'tasks', 'documents', 'info'];

  return (
    <div className="relative" ref={drawerRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-8 h-8 rounded-[8px] flex items-center justify-center hover:bg-[rgba(60,60,67,0.06)] transition-colors text-[#6C6C70]"
        aria-label={`Notifications${data.totalUnread > 0 ? ` (${data.totalUnread} unread)` : ''}`}
      >
        <Bell size={16} />
        {data.totalUnread > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-red text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
            {data.totalUnread > 99 ? '99+' : data.totalUnread}
          </span>
        )}
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute right-0 top-10 w-[360px] bg-white rounded-2xl border border-black/[0.06] shadow-elevated z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06]">
              <h3 className="text-[14px] font-semibold text-[#1C1C1E]">Notifications</h3>
              <div className="flex items-center gap-2">
                {data.totalUnread > 0 && (
                  <span className="text-[11px] text-[#6C6C70]">
                    {data.totalUnread} unread
                  </span>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/[0.06] transition-colors text-[#AEAEB2]"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-[480px] overflow-y-auto">
              {data.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center px-6">
                  <Bell size={28} className="text-[#AEAEB2]" />
                  <p className="text-[13px] font-medium text-[#1C1C1E]">All caught up</p>
                  <p className="text-[12px] text-[#6C6C70]">No new notifications</p>
                </div>
              ) : (
                sections.map((section) => {
                  const items = grouped[section];
                  if (!items || items.length === 0) return null;
                  const config = SECTION_CONFIG[section];
                  return (
                    <Fragment key={section}>
                      <div className="px-4 py-2 flex items-center gap-1.5">
                        <span className={config.color}>{config.icon}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#AEAEB2]">
                          {config.label}
                        </span>
                      </div>
                      {items.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => {
                            if (!item.read) markRead(item.id);
                            setOpen(false);
                          }}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-black/[0.03] transition-colors group"
                        >
                          <div
                            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                              item.read
                                ? 'bg-[rgba(60,60,67,0.06)] text-[#AEAEB2]'
                                : section === 'urgent'
                                ? 'bg-red/10 text-red'
                                : section === 'messages'
                                ? 'bg-blue/10 text-blue'
                                : section === 'tasks'
                                ? 'bg-orange/10 text-orange'
                                : section === 'documents'
                                ? 'bg-[#C9A95C]/10 text-[#C9A95C]'
                                : 'bg-[rgba(60,60,67,0.06)] text-[#6C6C70]'
                            }`}
                          >
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-[13px] leading-snug truncate ${
                                item.read ? 'text-[#6C6C70]' : 'text-[#1C1C1E] font-medium'
                              }`}
                            >
                              {item.title}
                            </p>
                            <p className="text-[11px] text-[#AEAEB2] mt-0.5 truncate">
                              {item.subtitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                            <span className="text-[10px] text-[#AEAEB2]">{item.time}</span>
                            {!item.read && (
                              <div className="w-1.5 h-1.5 rounded-full bg-[#007AFF]" />
                            )}
                            <ChevronRight size={10} className="text-[#AEAEB2] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </Link>
                      ))}
                    </Fragment>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {data.items.length > 0 && (
              <div className="px-4 py-3 border-t border-black/[0.06]">
                <Link
                  href="/inbox"
                  onClick={() => setOpen(false)}
                  className="text-[12px] text-[#007AFF] hover:underline font-medium"
                >
                  View all in Inbox
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
