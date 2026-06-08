'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  GitBranch,
  Users,
  CalendarDays,
  Inbox,
  Calculator,
  BrainCircuit,
  Plus,
  Zap,
  FileText,
  Phone,
  CheckSquare,
  Sparkles,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

interface CommandItem {
  id: string;
  group: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  shortcut?: string;
  action: () => void;
}

const NAV_ITEMS: Omit<CommandItem, 'action'>[] = [
  { id: 'nav-today', group: 'Navigate', label: 'Today', sublabel: "Your daily mission control", icon: <CalendarDays size={15} />, shortcut: 'T' },
  { id: 'nav-dashboard', group: 'Navigate', label: 'Dashboard', sublabel: 'Pipeline overview', icon: <LayoutDashboard size={15} /> },
  { id: 'nav-pipeline', group: 'Navigate', label: 'Pipeline', sublabel: 'All loans by stage', icon: <GitBranch size={15} /> },
  { id: 'nav-leads', group: 'Navigate', label: 'Leads', sublabel: 'Manage your contacts', icon: <Users size={15} /> },
  { id: 'nav-inbox', group: 'Navigate', label: 'Inbox', sublabel: 'Messages and alerts', icon: <Inbox size={15} /> },
  { id: 'nav-calendar', group: 'Navigate', label: 'Calendar', sublabel: 'Closing calendar', icon: <CalendarDays size={15} /> },
  { id: 'nav-rates', group: 'Navigate', label: 'Rate Calculator', sublabel: 'Pricing and products', icon: <Calculator size={15} /> },
  { id: 'nav-ai-coach', group: 'Navigate', label: 'AI Coach', sublabel: 'Your mortgage AI assistant', icon: <BrainCircuit size={15} /> },
  { id: 'nav-campaigns', group: 'Navigate', label: 'Campaigns', sublabel: 'Drip and blast sequences', icon: <Zap size={15} /> },
  { id: 'nav-applications', group: 'Navigate', label: 'Applications', sublabel: 'Digital 1003 pipeline', icon: <FileText size={15} /> },
];

const NAV_ROUTES: Record<string, string> = {
  'nav-today': '/today',
  'nav-dashboard': '/dashboard',
  'nav-pipeline': '/pipeline',
  'nav-leads': '/leads',
  'nav-inbox': '/inbox',
  'nav-calendar': '/calendar',
  'nav-rates': '/rates',
  'nav-ai-coach': '/ai-coach',
  'nav-campaigns': '/campaigns',
  'nav-applications': '/applications',
};

const QUICK_ACTIONS: Omit<CommandItem, 'action'>[] = [
  { id: 'qa-add-lead', group: 'Quick Actions', label: 'Add new lead', icon: <Plus size={15} /> },
  { id: 'qa-morning-brief', group: 'Quick Actions', label: 'Run morning briefing', icon: <Zap size={15} /> },
  { id: 'qa-rate-calc', group: 'Quick Actions', label: 'Open rate calculator', icon: <Calculator size={15} /> },
  { id: 'qa-start-call', group: 'Quick Actions', label: 'Start a call', icon: <Phone size={15} /> },
  { id: 'qa-create-task', group: 'Quick Actions', label: 'Create task', icon: <CheckSquare size={15} /> },
];

const AI_ACTIONS: Omit<CommandItem, 'action'>[] = [
  { id: 'ai-pipeline', group: 'AI Actions', label: 'Ask AI about my pipeline', icon: <Sparkles size={15} /> },
  { id: 'ai-market-post', group: 'AI Actions', label: 'Generate market update post', icon: <Sparkles size={15} /> },
  { id: 'ai-followup', group: 'AI Actions', label: 'Draft follow-up email', icon: <Sparkles size={15} /> },
];

const MAX_RECENT = 5;
const RECENT_KEY = 'conduit_cmd_recent';

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function addRecentSearch(q: string) {
  const prev = getRecentSearches().filter((r) => r !== q);
  const next = [q, ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

interface LeadResult {
  id: string;
  first_name: string;
  last_name: string;
  stage: string;
  loan_amount: number | null;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [leadResults, setLeadResults] = useState<LeadResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setActiveIndex(0);
      setLeadResults([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 3) {
      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search/global?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json() as { leads: LeadResult[] };
            setLeadResults(data.leads ?? []);
          }
        } catch {
          // silently fail
        } finally {
          setSearching(false);
        }
      }, 300);
    } else {
      setLeadResults([]);
      setSearching(false);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const buildItems = useCallback((): CommandItem[] => {
    const lq = query.toLowerCase();

    const items: CommandItem[] = [];

    // Navigate
    const navItems = query
      ? NAV_ITEMS.filter(
          (n) =>
            n.label.toLowerCase().includes(lq) ||
            (n.sublabel ?? '').toLowerCase().includes(lq)
        )
      : NAV_ITEMS;
    for (const n of navItems) {
      items.push({
        ...n,
        action: () => {
          if (query) addRecentSearch(query);
          router.push(NAV_ROUTES[n.id] ?? '/dashboard');
          onClose();
        },
      });
    }

    // Lead results (search mode)
    if (leadResults.length > 0) {
      for (const lead of leadResults) {
        items.push({
          id: `lead-${lead.id}`,
          group: 'Search Leads',
          label: `${lead.first_name} ${lead.last_name}`,
          sublabel: lead.loan_amount
            ? `$${(lead.loan_amount / 1000).toFixed(0)}K · ${lead.stage.replace(/_/g, ' ')}`
            : lead.stage.replace(/_/g, ' '),
          icon: (
            <div className="w-5 h-5 rounded-full bg-blue/10 flex items-center justify-center text-[9px] font-semibold text-blue">
              {lead.first_name[0]}{lead.last_name[0]}
            </div>
          ),
          badge: lead.stage.replace(/_/g, ' '),
          action: () => {
            if (query) addRecentSearch(query);
            router.push(`/leads/${lead.id}`);
            onClose();
          },
        });
      }
    }

    // Quick Actions
    const qaItems = query
      ? QUICK_ACTIONS.filter((a) => a.label.toLowerCase().includes(lq))
      : QUICK_ACTIONS;
    const QA_ROUTES: Record<string, string> = {
      'qa-add-lead': '/leads?new=1',
      'qa-morning-brief': '/ai-coach?brief=1',
      'qa-rate-calc': '/rates',
      'qa-start-call': '/leads?call=1',
      'qa-create-task': '/leads?task=1',
    };
    for (const a of qaItems) {
      items.push({
        ...a,
        action: () => {
          router.push(QA_ROUTES[a.id] ?? '/dashboard');
          onClose();
        },
      });
    }

    // AI Actions
    const aiItems = query
      ? AI_ACTIONS.filter((a) => a.label.toLowerCase().includes(lq))
      : AI_ACTIONS;
    const AI_ROUTES: Record<string, string> = {
      'ai-pipeline': '/ai-coach?q=pipeline',
      'ai-market-post': '/ai-coach?q=market-post',
      'ai-followup': '/ai-coach?q=followup',
    };
    for (const a of aiItems) {
      items.push({
        ...a,
        action: () => {
          router.push(AI_ROUTES[a.id] ?? '/ai-coach');
          onClose();
        },
      });
    }

    return items;
  }, [query, leadResults, router, onClose]);

  const items = buildItems();

  // Group items
  const grouped = items.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  // Flat index for keyboard nav
  const flatItems = Object.values(grouped).flat();

  const clampedIndex = Math.min(activeIndex, flatItems.length - 1);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = flatItems[clampedIndex];
        if (selected) selected.action();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, flatItems, clampedIndex]);

  // Reset index on query change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${clampedIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [clampedIndex]);

  const STAGE_COLORS: Record<string, string> = {
    new_inquiry: 'bg-[rgba(60,60,67,0.1)] text-[#1C1C1E]',
    pre_qual: 'bg-blue/10 text-blue',
    application: 'bg-blue/10 text-blue',
    processing: 'bg-blue/10 text-blue',
    underwriting: 'bg-orange/10 text-orange',
    conditional_approval: 'bg-orange/10 text-orange',
    clear_to_close: 'bg-gold/10 text-gold',
    closed: 'bg-green/10 text-green',
  };

  let flatIdx = 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[6px]" />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-[640px] mx-4 bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden border border-black/[0.06]"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.06]">
              <Search size={16} className="text-[#AEAEB2] flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search leads, pages, actions..."
                className="flex-1 text-[15px] text-[#1C1C1E] placeholder:text-[#AEAEB2] bg-transparent outline-none"
              />
              <div className="flex items-center gap-1 flex-shrink-0">
                {searching && (
                  <span className="text-[11px] text-[#AEAEB2]">Searching...</span>
                )}
                <kbd className="text-[10px] bg-[rgba(60,60,67,0.08)] text-[#6C6C70] px-1.5 py-0.5 rounded font-mono">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[420px] overflow-y-auto overscroll-contain py-2">
              {flatItems.length === 0 && !searching && query.length >= 3 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Search size={24} className="text-[#AEAEB2]" />
                  <p className="text-sm text-[#6C6C70]">No results for "{query}"</p>
                </div>
              )}

              {Object.entries(grouped).map(([group, groupItems]) => {
                return (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-[10px] font-semibold text-[#AEAEB2] uppercase tracking-wider">
                      {group}
                    </div>
                    {groupItems.map((item) => {
                      const idx = flatIdx++;
                      const isActive = idx === clampedIndex;
                      return (
                        <button
                          key={item.id}
                          data-idx={idx}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={item.action}
                          className={clsx(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75',
                            isActive ? 'bg-[#C9A95C] text-white' : 'text-[#1C1C1E] hover:bg-black/[0.04]'
                          )}
                        >
                          <span
                            className={clsx(
                              'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
                              isActive ? 'bg-white/20' : 'bg-[rgba(60,60,67,0.06)]'
                            )}
                          >
                            {item.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={clsx('text-[14px] font-medium truncate', isActive ? 'text-white' : 'text-[#1C1C1E]')}>
                              {item.label}
                            </p>
                            {item.sublabel && (
                              <p className={clsx('text-[12px] truncate mt-0.5', isActive ? 'text-white/70' : 'text-[#6C6C70]')}>
                                {item.sublabel}
                              </p>
                            )}
                          </div>
                          {item.badge && !isActive && (
                            <span className={clsx(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
                              STAGE_COLORS[item.badge.replace(/ /g, '_')] ?? 'bg-[rgba(60,60,67,0.08)] text-[#6C6C70]'
                            )}>
                              {item.badge}
                            </span>
                          )}
                          {item.shortcut && (
                            <kbd className={clsx(
                              'text-[10px] px-1.5 py-0.5 rounded font-mono flex-shrink-0',
                              isActive ? 'bg-white/20 text-white' : 'bg-[rgba(60,60,67,0.06)] text-[#AEAEB2]'
                            )}>
                              {item.shortcut}
                            </kbd>
                          )}
                          {isActive && <ChevronRight size={12} className="text-white/60 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Empty state when no query */}
              {!query && flatItems.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-[#AEAEB2]">Type to search leads, navigate, or take actions</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-black/[0.06] flex items-center gap-4 text-[11px] text-[#AEAEB2]">
              <span className="flex items-center gap-1"><kbd className="bg-[rgba(60,60,67,0.06)] px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="bg-[rgba(60,60,67,0.06)] px-1 py-0.5 rounded font-mono">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="bg-[rgba(60,60,67,0.06)] px-1 py-0.5 rounded font-mono">Esc</kbd> close</span>
              <span className="flex items-center gap-1 ml-auto"><Clock size={10} /> recent searches saved locally</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
