'use client';

import { useState, useMemo } from 'react';
import {
  TrendingDown, Home, Heart, Users, AlertCircle, Send, Check,
  Sparkles, ChevronRight, Filter,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClosedBorrower {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  loan_amount: number | null;
  loan_type: string | null;
  closing_date: string | null;
  original_rate?: number | null;
  last_contacted_at: string | null;
  created_at: string;
}

interface NurtureSequence {
  id: string;
  lead_id: string;
  sequence_type: string;
  scheduled_date: string;
  status: string;
}

interface SequenceConfig {
  id: string;
  label: string;
  description: string;
  triggerDays: number;
  enabled: boolean;
}

interface PostCloseClientProps {
  borrowers: ClosedBorrower[];
  sequences: NurtureSequence[];
  currentMarketRate: number;
}

// ── Static sequence config ─────────────────────────────────────────────────────

const DEFAULT_SEQUENCES: SequenceConfig[] = [
  { id: '30_day_checkin', label: '30-Day Check-In', description: '"How\'s the new home?" personal touch', triggerDays: 30, enabled: true },
  { id: '60_day_utility', label: '60-Day Utility Tips', description: 'Setup tips for utilities, internet, etc.', triggerDays: 60, enabled: true },
  { id: '90_day_maintenance', label: '90-Day Home Maintenance', description: 'Seasonal maintenance checklist', triggerDays: 90, enabled: true },
  { id: '180_day_equity', label: '6-Month Equity Update', description: 'Show how much equity they\'ve built', triggerDays: 180, enabled: true },
  { id: '1yr_anniversary', label: '1-Year Home Anniversary', description: 'Celebrate their home anniversary', triggerDays: 365, enabled: true },
  { id: 'annual_review', label: 'Annual Mortgage Review', description: 'Refi opportunity analysis', triggerDays: 365, enabled: false },
  { id: 'rate_drop_alert', label: 'Rate Drop Alert', description: 'Triggers from rate watch engine', triggerDays: 0, enabled: true },
  { id: 'referral_ask', label: 'Referral Ask', description: '90 days post-close if no referral yet', triggerDays: 90, enabled: true },
];

// ── Utility helpers ────────────────────────────────────────────────────────────

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function estimatedBalance(loanAmount: number, daysSinceClose: number): number {
  // Simple 30-yr fixed amortization approximation
  const monthlyRate = 0.07 / 12;
  const n = 360;
  const payment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  const monthsElapsed = Math.floor(daysSinceClose / 30);
  let balance = loanAmount;
  for (let i = 0; i < monthsElapsed && i < n; i++) {
    const interest = balance * monthlyRate;
    balance -= (payment - interest);
  }
  return Math.max(0, balance);
}

function estimatedEquity(loanAmount: number | null, daysSinceClose: number): { balance: number; equity: number; estimatedValue: number } {
  if (!loanAmount) return { balance: 0, equity: 0, estimatedValue: 0 };
  const balance = estimatedBalance(loanAmount, daysSinceClose);
  // Assume 4% annual appreciation
  const estimatedValue = loanAmount / 0.8 * Math.pow(1.04, daysSinceClose / 365);
  const equity = estimatedValue - balance;
  return { balance, equity, estimatedValue };
}

function rateGap(originalRate: number | null, marketRate: number): number {
  if (!originalRate) return 0;
  return originalRate - marketRate;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n)}`;
}

// ── Nurture List Table ─────────────────────────────────────────────────────────

type ListFilter = 'all' | 'refi_eligible' | 'anniversary' | 'birthday';

function NurtureList({ borrowers, currentMarketRate }: { borrowers: ClosedBorrower[]; currentMarketRate: number }) {
  const [filter, setFilter] = useState<ListFilter>('all');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const REFI_THRESHOLD = 0.75;

  const enriched = useMemo(() => borrowers.map(b => {
    const days = daysSince(b.closing_date);
    const gap = rateGap(b.original_rate ?? null, currentMarketRate);
    const { equity } = estimatedEquity(b.loan_amount, days);
    return { ...b, daysSinceClose: days, rateGap: gap, estimatedEquity: equity };
  }), [borrowers, currentMarketRate]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'refi_eligible': return enriched.filter(b => b.rateGap >= REFI_THRESHOLD);
      case 'anniversary': return enriched.filter(b => {
        const days = b.daysSinceClose % 365;
        return days <= 30 || days >= 335;
      });
      default: return enriched;
    }
  }, [enriched, filter]);

  const handleSendReferralAsk = async (borrowerId: string) => {
    setGeneratingId(borrowerId);
    // Simulate AI generation + send
    await new Promise(r => setTimeout(r, 1500));
    setGeneratingId(null);
    setSentIds(prev => new Set(prev).add(borrowerId));
  };

  if (borrowers.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-black/[0.06] shadow-sm rounded-2xl">
        <Home size={32} className="text-[#C7C7CC] mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-[#1C1C1E] mb-1">No closed borrowers yet</p>
        <p className="text-[13px] text-[#8A8A8E]">Leads moved to the "Closed" stage will appear here for post-close nurture</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={13} className="text-[#8A8A8E]" />
        {[
          { id: 'all' as ListFilter, label: 'All' },
          { id: 'refi_eligible' as ListFilter, label: `Refi Eligible (>${REFI_THRESHOLD}% gap)` },
          { id: 'anniversary' as ListFilter, label: 'Anniversary' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-medium border transition-all ${
              filter === f.id
                ? 'bg-[#C9A95C] text-white border-[#C9A95C]'
                : 'border-black/[0.10] bg-white text-[#3C3C43] hover:bg-[#F2F2F7]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-black/[0.06] shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#F9F9FB]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide">Borrower</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide">Closed</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide">Loan Amount</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide">Equity (Est.)</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide">Rate Gap</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#8A8A8E] uppercase tracking-wide">Last Contact</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b, idx) => {
                const isRefiOpportunity = b.rateGap >= REFI_THRESHOLD;
                return (
                  <tr key={b.id} className={`border-b border-black/[0.04] last:border-0 ${idx % 2 === 0 ? '' : 'bg-[#F9F9FB]/50'}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#1C1C1E]">{b.first_name} {b.last_name}</p>
                      <p className="text-[11px] text-[#8A8A8E]">{b.email}</p>
                    </td>
                    <td className="px-4 py-3 text-[#3C3C43]">
                      {b.closing_date ? new Date(b.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                      <p className="text-[11px] text-[#8A8A8E]">{b.daysSinceClose}d ago</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#1C1C1E]">
                      {b.loan_amount ? formatCurrency(b.loan_amount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[#34C759]">
                      {b.estimatedEquity > 0 ? formatCurrency(b.estimatedEquity) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {b.rateGap !== 0 ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          isRefiOpportunity
                            ? 'bg-[#FF3B30]/15 text-[#FF3B30]'
                            : 'bg-[#8A8A8E]/10 text-[#8A8A8E]'
                        }`}>
                          {isRefiOpportunity && <TrendingDown size={10} />}
                          {b.rateGap > 0 ? '+' : ''}{b.rateGap.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-[#C7C7CC] text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#8A8A8E]">
                      {b.last_contacted_at
                        ? `${daysSince(b.last_contacted_at)}d ago`
                        : <span className="text-[#FF9500]">Never</span>}
                    </td>
                    <td className="px-4 py-3">
                      {!sentIds.has(b.id) ? (
                        <button
                          onClick={() => handleSendReferralAsk(b.id)}
                          disabled={generatingId === b.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A95C] text-white text-[11px] font-semibold hover:bg-[#0066CC] disabled:opacity-40 transition-colors whitespace-nowrap"
                        >
                          {generatingId === b.id ? <Sparkles size={11} className="animate-pulse" /> : <Send size={11} />}
                          {generatingId === b.id ? 'Generating…' : isRefiOpportunity ? 'Send Refi Alert' : 'Referral Ask'}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] text-[#34C759]">
                          <Check size={11} />
                          Sent
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Automated Sequences Config ─────────────────────────────────────────────────

function SequencesConfig() {
  const [sequences, setSequences] = useState<SequenceConfig[]>(DEFAULT_SEQUENCES);

  const toggle = (id: string) => {
    setSequences(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const activeCount = sequences.filter(s => s.enabled).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[#8A8A8E]">{activeCount} of {sequences.length} sequences active</p>
        <button className="text-[12px] text-[#C9A95C] font-medium">
          Enable All
        </button>
      </div>

      <div className="space-y-2">
        {sequences.map(seq => (
          <div
            key={seq.id}
            className="flex items-center justify-between bg-white border border-black/[0.06] shadow-sm rounded-2xl px-4 py-3.5"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-[#1C1C1E]">{seq.label}</p>
                {seq.triggerDays > 0 && (
                  <span className="text-[10px] text-[#8A8A8E] bg-[#F2F2F7] px-1.5 py-0.5 rounded-full">
                    Day {seq.triggerDays}
                  </span>
                )}
                {seq.id === 'rate_drop_alert' && (
                  <span className="text-[10px] text-[#FF9500] bg-[#FF9500]/10 px-1.5 py-0.5 rounded-full">
                    Event-Triggered
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8A8A8E] mt-0.5">{seq.description}</p>
            </div>
            <div
              onClick={() => toggle(seq.id)}
              className={`flex-shrink-0 w-10 h-6 rounded-full transition-colors relative cursor-pointer ${seq.enabled ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${seq.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Home Equity Tracker ────────────────────────────────────────────────────────

function EquityTracker({ borrowers, currentMarketRate }: { borrowers: ClosedBorrower[]; currentMarketRate: number }) {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const withEquity = useMemo(() =>
    borrowers
      .filter(b => b.loan_amount && b.closing_date)
      .map(b => {
        const days = daysSince(b.closing_date);
        const { balance, equity, estimatedValue } = estimatedEquity(b.loan_amount, days);
        const ltv = estimatedValue > 0 ? (balance / estimatedValue) * 100 : 0;
        return { ...b, days, balance, equity, estimatedValue, ltv };
      })
      .sort((a, b) => b.equity - a.equity),
    [borrowers]
  );

  const handleSendUpdate = async (id: string) => {
    setGeneratingId(id);
    await new Promise(r => setTimeout(r, 1500));
    setGeneratingId(null);
    setSentIds(prev => new Set(prev).add(id));
  };

  if (withEquity.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-black/[0.06] shadow-sm rounded-2xl">
        <Home size={32} className="text-[#C7C7CC] mx-auto mb-3" />
        <p className="text-[14px] text-[#8A8A8E]">No closed borrowers with loan data to track</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#C9A95C]/08 border border-[#C9A95C]/20">
        <AlertCircle size={14} className="text-[#C9A95C] mt-0.5 flex-shrink-0" />
        <p className="text-[12px] text-[#C9A95C]">
          Equity estimates use 4% annual appreciation and a 7% 30-yr amortization model. Actual values depend on market conditions. Always recommend a formal appraisal before refinancing.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {withEquity.map(b => (
          <div key={b.id} className="bg-white border border-black/[0.06] shadow-sm rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <p className="text-[14px] font-semibold text-[#1C1C1E]">{b.first_name} {b.last_name}</p>
                <p className="text-[11px] text-[#8A8A8E]">Closed {daysSince(b.closing_date)}d ago</p>
              </div>
              <span className="text-[11px] font-mono text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-full flex-shrink-0">
                {b.ltv.toFixed(0)}% LTV
              </span>
            </div>

            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between text-[12px]">
                <span className="text-[#8A8A8E]">Original Loan</span>
                <span className="font-mono text-[#1C1C1E]">{b.loan_amount ? formatCurrency(b.loan_amount) : '—'}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#8A8A8E]">Est. Balance</span>
                <span className="font-mono text-[#1C1C1E]">{formatCurrency(b.balance)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-[#8A8A8E]">Est. Value</span>
                <span className="font-mono text-[#1C1C1E]">{formatCurrency(b.estimatedValue)}</span>
              </div>
              <div className="flex justify-between text-[12px] pt-1 border-t border-black/[0.04]">
                <span className="font-semibold text-[#1C1C1E]">Est. Equity</span>
                <span className="font-mono font-bold text-[#34C759]">{formatCurrency(b.equity)}</span>
              </div>
            </div>

            {/* Equity bar */}
            <div className="h-2 bg-[#F2F2F7] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[#34C759] rounded-full transition-all"
                style={{ width: `${Math.min(100, 100 - b.ltv)}%` }}
              />
            </div>

            {!sentIds.has(b.id) ? (
              <button
                onClick={() => handleSendUpdate(b.id)}
                disabled={generatingId === b.id}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[#C9A95C] text-[#C9A95C] text-[12px] font-semibold hover:bg-[#C9A95C]/05 disabled:opacity-40 transition-colors"
              >
                {generatingId === b.id ? <Sparkles size={12} className="animate-pulse" /> : <Send size={12} />}
                {generatingId === b.id ? 'Generating…' : 'Send Equity Update'}
              </button>
            ) : (
              <div className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#34C759]/10 text-[#34C759] text-[12px] font-semibold">
                <Check size={12} />
                Update Sent
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

type Tab = 'nurture' | 'sequences' | 'equity';

export function PostCloseClient({ borrowers, sequences, currentMarketRate }: PostCloseClientProps) {
  const [tab, setTab] = useState<Tab>('nurture');

  const refiEligible = borrowers.filter(b => rateGap(b.original_rate ?? null, currentMarketRate) >= 0.75).length;
  const totalEquity = borrowers.reduce((sum, b) => {
    const { equity } = estimatedEquity(b.loan_amount, daysSince(b.closing_date));
    return sum + equity;
  }, 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'nurture', label: 'Nurture List', icon: <Users size={14} /> },
    { id: 'sequences', label: 'Automated Sequences', icon: <ChevronRight size={14} /> },
    { id: 'equity', label: 'Home Equity Tracker', icon: <Home size={14} /> },
  ];

  return (
    <div className="space-y-5">
      {refiEligible > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/20">
          <TrendingDown size={15} className="text-[#FF3B30] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-[#FF3B30]">
              {refiEligible} borrower{refiEligible > 1 ? 's' : ''} may be refi-eligible
            </p>
            <p className="text-[12px] text-[#FF3B30]/80">
              Current market rate ({currentMarketRate.toFixed(3)}%) is 0.75%+ below their original rate
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1 p-1 bg-[#E5E5EA] rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-medium transition-all ${
              tab === t.id ? 'bg-white text-[#1C1C1E] shadow-sm' : 'text-[#3C3C43] hover:text-[#1C1C1E]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'nurture' && <NurtureList borrowers={borrowers} currentMarketRate={currentMarketRate} />}
      {tab === 'sequences' && <SequencesConfig />}
      {tab === 'equity' && <EquityTracker borrowers={borrowers} currentMarketRate={currentMarketRate} />}
    </div>
  );
}
