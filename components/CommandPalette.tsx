'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  Users,
  GitBranch,
  Inbox,
  FileText,
  BarChart2,
  Settings,
  Calendar,
  Plus,
  Zap,
  Target,
  Brain,
  Clock,
  AlertTriangle,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
  badge?: string;
  badgeColor?: string;
  shortcut?: string;
}

interface LeadResult {
  id: string;
  first_name: string;
  last_name: string;
  stage: string;
  loan_amount: number | null;
  email: string;
}

const STAGE_COLORS: Record<string, string> = {
  new_inquiry: 'bg-[rgba(60,60,67,0.12)] text-[#6C6C70]',
  pre_qual: 'bg-blue/10 text-blue',
  application: 'bg-blue/10 text-blue',
  processing: 'bg-blue/10 text-blue',
  underwriting: 'bg-orange/10 text-orange',
  conditional_approval: 'bg-orange/10 text-orange',
  clear_to_close: 'bg-[#C9A95C]/15 text-[#C9A95C]',
  closed: 'bg-green/10 text-green',
  declined: 'bg-red/10 text-red',
  withdrawn: 'bg-[rgba(60,60,67,0.12)] text-[#6C6C70]',
};

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New',
  pre_qual: 'Pre-Qual',
  application: 'App',
  processing: 'Processing',
  underwriting: 'UW',
  conditional_approval: 'Cond. Appr.',
  clear_to_close: 'CTC',
  closed: 'Closed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [leadResults, setLeadResults] = useState<LeadResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  // Recent pages from localStorage
  const getRecentPages = useCallback((): CommandItem[] => {
    try {
      const raw = localStorage.getItem('conduit_recent_pages');
      const pages: Array<{ label: string; path: string }> = raw ? JSON.parse(raw) : [];
      return pages.slice(0, 5).map((p) => ({
        id: `recent-${p.path}`,
        label: p.label,
        icon: <Clock size={14} className="text-label-3" />,
        category: 'Recent',
        action: () => navigate(p.path),
      }));
    } catch {
      return [];
    }
  }, []);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      setOpen(false);
      setQuery('');
    },
    [router]
  );

  // Static commands
  const staticCommands: CommandItem[] = [
    // Navigate
    {
      id: 'nav-today',
      label: 'Go to Today',
      description: 'Your daily action list',
      icon: <Target size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/today'),
      shortcut: '⌘T',
    },
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: <LayoutDashboard size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/dashboard'),
    },
    {
      id: 'nav-pipeline',
      label: 'Go to Pipeline',
      icon: <GitBranch size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/pipeline'),
    },
    {
      id: 'nav-leads',
      label: 'Go to Leads',
      icon: <Users size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/leads'),
    },
    {
      id: 'nav-inbox',
      label: 'Go to Inbox',
      icon: <Inbox size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/inbox'),
    },
    {
      id: 'nav-calendar',
      label: 'Pipeline Calendar',
      description: 'Revenue calendar & closing forecast',
      icon: <Calendar size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/calendar'),
    },
    {
      id: 'nav-applications',
      label: 'Go to Applications',
      icon: <FileText size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/applications'),
    },
    {
      id: 'nav-reports',
      label: 'Go to Reports',
      icon: <BarChart2 size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/reports'),
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: <Settings size={14} className="text-blue" />,
      category: 'Navigate',
      action: () => navigate('/settings'),
    },
    // Create
    {
      id: 'create-lead',
      label: 'New Lead',
      icon: <Plus size={14} className="text-green" />,
      category: 'Create',
      action: () => navigate('/leads/new'),
      shortcut: '⌘N',
    },
    {
      id: 'create-task',
      label: 'New Task',
      icon: <Plus size={14} className="text-green" />,
      category: 'Create',
      action: () => navigate('/leads/new?tab=task'),
    },
    {
      id: 'create-campaign',
      label: 'New Campaign',
      icon: <Plus size={14} className="text-green" />,
      category: 'Create',
      action: () => navigate('/campaigns/new'),
    },
    {
      id: 'create-app-residential',
      label: 'New Application — Residential',
      icon: <Plus size={14} className="text-green" />,
      category: 'Create',
      action: () => navigate('/applications/new?type=residential'),
    },
    {
      id: 'create-app-nonqm',
      label: 'New Application — Non-QM',
      icon: <Plus size={14} className="text-green" />,
      category: 'Create',
      action: () => navigate('/applications/new?type=non_qm'),
    },
    {
      id: 'create-app-commercial',
      label: 'New Application — Commercial',
      icon: <Plus size={14} className="text-green" />,
      category: 'Create',
      action: () => navigate('/applications/new?type=commercial'),
    },
    // Quick actions
    {
      id: 'action-morning',
      label: 'Run Morning Briefing',
      description: 'Get AI-powered daily priorities',
      icon: <Zap size={14} className="text-gold" />,
      category: 'Quick Actions',
      action: () => navigate('/ai-coach?prompt=morning_briefing'),
    },
    {
      id: 'action-trid',
      label: 'Check TRID Deadlines',
      description: 'Review all compliance deadlines',
      icon: <AlertTriangle size={14} className="text-orange" />,
      category: 'Quick Actions',
      action: () => navigate('/leads?trid=urgent'),
    },
    {
      id: 'action-ratewatch',
      label: 'Rate Watch Scan',
      description: 'Find refi opportunities in pipeline',
      icon: <TrendingUp size={14} className="text-green" />,
      category: 'Quick Actions',
      action: () => navigate('/rates'),
    },
    {
      id: 'action-aicoach',
      label: 'Open AI Coach',
      icon: <Brain size={14} className="text-gold" />,
      category: 'Quick Actions',
      action: () => navigate('/ai-coach'),
    },
  ];

  // Debounced lead search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setLeadResults([]);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('leads')
        .select('id, first_name, last_name, stage, loan_amount, email')
        .or(
          `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`
        )
        .limit(5);
      setLeadResults((data as LeadResult[]) ?? []);
      setSearching(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, supabase]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build filtered items
  const filteredCommands = query.trim().length === 0
    ? staticCommands
    : staticCommands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          (cmd.description?.toLowerCase().includes(query.toLowerCase()) ?? false)
      );

  const leadCommandItems: CommandItem[] = leadResults.map((lead) => ({
    id: `lead-${lead.id}`,
    label: `${lead.first_name} ${lead.last_name}`,
    description: `${lead.email}${lead.loan_amount ? ` · ${formatCurrency(lead.loan_amount)}` : ''}`,
    icon: (
      <div className="w-5 h-5 rounded-full bg-blue/10 flex items-center justify-center">
        <span className="text-[9px] font-semibold text-blue">
          {lead.first_name[0]}{lead.last_name[0]}
        </span>
      </div>
    ),
    category: 'Leads',
    action: () => navigate(`/leads/${lead.id}`),
    badge: STAGE_LABELS[lead.stage] ?? lead.stage,
    badgeColor: STAGE_COLORS[lead.stage] ?? 'bg-fill text-label-2',
  }));

  const recentItems = query.trim().length === 0 ? getRecentPages() : [];

  // Group all items
  type GroupedItems = Record<string, CommandItem[]>;
  const grouped: GroupedItems = {};

  for (const item of [...recentItems, ...filteredCommands, ...leadCommandItems]) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  const flatItems = Object.values(grouped).flat();

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        flatItems[selectedIndex]?.action();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flatItems, selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  let runningIndex = 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 -translate-x-1/2 top-[15vh] z-50 w-full max-w-xl px-4 sm:px-0"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
          >
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.20),0_1px_4px_rgba(0,0,0,0.06)] border border-black/[0.06] overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-black/[0.06]">
                <Search size={16} className="text-[#AEAEB2] flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search leads, navigate, or run a command..."
                  className="flex-1 text-sm text-black placeholder:text-[#AEAEB2] bg-transparent outline-none"
                  aria-label="Command search"
                  autoComplete="off"
                  spellCheck={false}
                />
                {searching && (
                  <div className="w-4 h-4 border-2 border-blue/30 border-t-blue rounded-full animate-spin" />
                )}
                <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-[#AEAEB2] bg-[rgba(60,60,67,0.08)] border border-[rgba(60,60,67,0.12)]">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto py-2" role="listbox">
                {flatItems.length === 0 && query.trim().length > 0 && !searching && (
                  <div className="px-4 py-8 text-center text-sm text-[#AEAEB2]">
                    No results for "{query}"
                  </div>
                )}

                {Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#AEAEB2]">
                      {category}
                    </p>
                    {items.map((item) => {
                      const index = runningIndex++;
                      const isSelected = index === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setSelectedIndex(index)}
                          onClick={item.action}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100 ${
                            isSelected ? 'bg-blue/[0.06]' : 'hover:bg-[rgba(60,60,67,0.04)]'
                          }`}
                        >
                          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-black truncate">
                              {item.label}
                            </p>
                            {item.description && (
                              <p className="text-[11px] text-[#AEAEB2] truncate mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${item.badgeColor}`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.shortcut && (
                            <kbd className="text-[10px] font-mono text-[#AEAEB2] hidden sm:block">
                              {item.shortcut}
                            </kbd>
                          )}
                          {isSelected && (
                            <ChevronRight size={12} className="text-[#AEAEB2] flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-4 px-4 py-2 border-t border-black/[0.06] bg-[rgba(60,60,67,0.02)]">
                <span className="text-[10px] text-[#AEAEB2]">
                  <kbd className="font-mono">↑↓</kbd> navigate
                </span>
                <span className="text-[10px] text-[#AEAEB2]">
                  <kbd className="font-mono">↵</kbd> open
                </span>
                <span className="text-[10px] text-[#AEAEB2]">
                  <kbd className="font-mono">esc</kbd> close
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
