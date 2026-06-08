'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Star, Building2, Phone, Mail, Globe, ChevronRight,
  Filter, X, Plus, Info, SlidersHorizontal, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { cn, formatPhone } from '@/lib/utils';
import { SEED_LENDERS, type SeedLender } from '@/lib/lenders/seed-data';
import AddLenderModal from './AddLenderModal';
import ScenarioMatcherModal from './ScenarioMatcherModal';

// DB lender shape (org's own lenders)
export interface DbLender {
  id: string;
  name: string;
  channel: string;
  website: string | null;
  ae_name: string | null;
  ae_phone: string | null;
  ae_email: string | null;
  products: string[];
  licensed_states: string[];
  min_fico: number | null;
  max_ltv: number | null;
  specialty_tags: string[];
  avg_turnaround_days: number | null;
  is_preferred: boolean;
  notes: string | null;
  loans_submitted: number;
  loans_closed: number;
  avg_days_to_close: number | null;
}

interface Props {
  orgLenders: DbLender[];
}

const LOAN_TYPES = [
  'Conventional', 'FHA', 'VA', 'USDA', 'Jumbo', 'Non-QM',
  'DSCR', 'Bank Statement', 'Bridge', 'Commercial', 'SBA', 'Construction',
];

const SPECIALTIES = [
  'Non-QM specialist', 'DSCR specialist', 'Foreign national',
  'ITIN', 'Recent credit events', 'Self-employed',
];

const CHANNELS: Record<string, string> = {
  wholesale: 'Wholesale',
  correspondent: 'Correspondent',
  direct: 'Direct',
  hard_money: 'Hard Money',
  private: 'Private',
};

const CHANNEL_COLORS: Record<string, string> = {
  wholesale: 'bg-blue/10 text-blue',
  correspondent: 'bg-purple/10 text-purple',
  direct: 'bg-success/10 text-success',
  hard_money: 'bg-warning/10 text-[#FF9500]',
  private: 'bg-danger/10 text-danger',
};

function pullThroughColor(rate: number): string {
  if (rate >= 40) return 'text-success';
  if (rate >= 25) return 'text-warning';
  return 'text-danger';
}

interface UnifiedLender {
  id: string;
  name: string;
  channel: string;
  products: string[];
  licensed_states: string[];
  min_fico: number;
  max_ltv: number;
  specialty_tags: string[];
  avg_turnaround_days: number;
  is_preferred: boolean;
  notes: string;
  loans_submitted: number;
  loans_closed: number;
  avg_days_to_close: number;
  ae_name: string;
  ae_phone: string;
  ae_email: string;
  isSample: boolean;
}

function toUnified(l: SeedLender): UnifiedLender {
  return {
    id: l.id,
    name: l.name,
    channel: l.channel,
    products: l.products,
    licensed_states: l.licensed_states,
    min_fico: l.min_fico,
    max_ltv: l.max_ltv,
    specialty_tags: l.specialty_tags,
    avg_turnaround_days: l.avg_turnaround_days,
    is_preferred: l.is_preferred,
    notes: l.notes,
    loans_submitted: l.loans_submitted,
    loans_closed: l.loans_closed,
    avg_days_to_close: l.avg_days_to_close,
    ae_name: l.ae_name,
    ae_phone: l.ae_phone,
    ae_email: l.ae_email,
    isSample: true,
  };
}

function dbToUnified(l: DbLender): UnifiedLender {
  return {
    id: l.id,
    name: l.name,
    channel: l.channel,
    products: l.products,
    licensed_states: l.licensed_states,
    min_fico: l.min_fico ?? 0,
    max_ltv: l.max_ltv ?? 100,
    specialty_tags: l.specialty_tags,
    avg_turnaround_days: l.avg_turnaround_days ?? 0,
    is_preferred: l.is_preferred,
    notes: l.notes ?? '',
    loans_submitted: l.loans_submitted,
    loans_closed: l.loans_closed,
    avg_days_to_close: l.avg_days_to_close ?? 0,
    ae_name: l.ae_name ?? '',
    ae_phone: l.ae_phone ?? '',
    ae_email: l.ae_email ?? '',
    isSample: false,
  };
}

export default function LendersClient({ orgLenders }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedLoanTypes, setSelectedLoanTypes] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [minFico, setMinFico] = useState(500);
  const [maxLtv, setMaxLtv] = useState(100);
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScenarioMatcher, setShowScenarioMatcher] = useState(false);
  const [activeTab, setActiveTab] = useState<'directory' | 'performance'>('directory');

  const allLenders: UnifiedLender[] = useMemo(() => {
    const org = orgLenders.map(dbToUnified);
    const samples = orgLenders.length === 0 ? SEED_LENDERS.map(toUnified) : [];
    return [
      ...org.filter((l) => l.is_preferred),
      ...samples.filter((l) => l.is_preferred),
      ...org.filter((l) => !l.is_preferred),
      ...samples.filter((l) => !l.is_preferred),
    ];
  }, [orgLenders]);

  const filtered = useMemo(() => {
    return allLenders.filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !l.name.toLowerCase().includes(q) &&
          !l.ae_name.toLowerCase().includes(q) &&
          !l.products.some((p) => p.toLowerCase().includes(q))
        ) return false;
      }
      if (selectedLoanTypes.length > 0) {
        if (!selectedLoanTypes.some((t) => l.products.includes(t))) return false;
      }
      if (selectedSpecialties.length > 0) {
        if (!selectedSpecialties.some((s) => l.specialty_tags.includes(s))) return false;
      }
      if (l.min_fico > 0 && l.min_fico > minFico) return false;
      if (l.max_ltv < maxLtv - 5) return false;
      return true;
    });
  }, [allLenders, search, selectedLoanTypes, selectedSpecialties, minFico, maxLtv]);

  const isSampleMode = orgLenders.length === 0;

  function toggleLoanType(t: string) {
    setSelectedLoanTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  }
  function toggleSpecialty(s: string) {
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }
  function clearFilters() {
    setSelectedLoanTypes([]);
    setSelectedSpecialties([]);
    setMinFico(500);
    setMaxLtv(100);
  }

  const activeFilterCount =
    selectedLoanTypes.length +
    selectedSpecialties.length +
    (minFico > 500 ? 1 : 0) +
    (maxLtv < 100 ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold text-navy tracking-tight">Lender Marketplace</h1>
          <p className="text-sm text-label2 mt-0.5">
            {isSampleMode
              ? 'Sample lender data — add your wholesale AE relationships to track performance'
              : `${orgLenders.length} lender${orgLenders.length !== 1 ? 's' : ''} in your network`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowScenarioMatcher(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-black/[0.1] bg-white text-sm font-medium text-label hover:bg-black/[0.02] transition-colors shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-blue" />
            Scenario Matcher
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-sm font-medium hover:bg-[#B08D3C] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Lender
          </button>
        </div>
      </div>

      {/* Sample data banner */}
      {isSampleMode && (
        <div className="flex items-start gap-3 bg-[#C9A95C]/[0.06] border border-[#C9A95C]/[0.15] rounded-2xl p-4">
          <Info className="w-4 h-4 text-blue flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-navy">Sample lender data — for reference only</p>
            <p className="text-xs text-label2 mt-0.5">
              These are illustrative lenders to help you explore the marketplace. Add your actual wholesale AE relationships using the &quot;Add Lender&quot; button to track real performance data.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1 w-fit">
        {(['directory', 'performance'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-1.5 rounded-[10px] text-sm font-medium transition-all capitalize',
              activeTab === tab
                ? 'bg-white text-label shadow-sm'
                : 'text-label2 hover:text-label'
            )}
          >
            {tab === 'directory' ? 'Directory' : 'Performance'}
          </button>
        ))}
      </div>

      {activeTab === 'directory' ? (
        <>
          {/* Search + Filter bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-label3" />
              <input
                type="text"
                placeholder="Search lenders, products, AE name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-black/[0.08] rounded-xl text-sm placeholder:text-label3 focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue/40"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                showFilters || activeFilterCount > 0
                  ? 'bg-blue/[0.08] border-blue/30 text-blue'
                  : 'bg-white border-black/[0.08] text-label hover:bg-black/[0.02]'
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-blue text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5 leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm text-label2 hover:text-label transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="bg-white border border-black/[0.06] rounded-2xl p-5 shadow-sm space-y-5">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-3">Loan Type</p>
                  <div className="flex flex-wrap gap-2">
                    {LOAN_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleLoanType(t)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                          selectedLoanTypes.includes(t)
                            ? 'bg-blue text-white border-blue'
                            : 'bg-transparent text-label2 border-black/[0.1] hover:border-blue/40 hover:text-blue'
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-label2 uppercase tracking-wide mb-3">Specialty</p>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTIES.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleSpecialty(s)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                          selectedSpecialties.includes(s)
                            ? 'bg-purple text-white border-purple'
                            : 'bg-transparent text-label2 border-black/[0.1] hover:border-purple/40 hover:text-purple'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-black/[0.04]">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-label2 uppercase tracking-wide">Min FICO (borrower)</p>
                    <span className="text-xs font-mono font-semibold text-navy">{minFico}</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={780}
                    value={minFico}
                    onChange={(e) => setMinFico(Number(e.target.value))}
                    className="w-full accent-blue"
                  />
                  <div className="flex justify-between text-[10px] text-label3 mt-1">
                    <span>500</span><span>780</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-label2 uppercase tracking-wide">Max LTV needed</p>
                    <span className="text-xs font-mono font-semibold text-navy">{maxLtv}%</span>
                  </div>
                  <input
                    type="range"
                    min={65}
                    max={100}
                    value={maxLtv}
                    onChange={(e) => setMaxLtv(Number(e.target.value))}
                    className="w-full accent-blue"
                  />
                  <div className="flex justify-between text-[10px] text-label3 mt-1">
                    <span>65%</span><span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results count */}
          <p className="text-xs text-label3">
            Showing {filtered.length} of {allLenders.length} lenders
          </p>

          {/* Lender cards */}
          {filtered.length === 0 ? (
            <div className="bg-white border border-black/[0.06] rounded-2xl p-12 text-center shadow-sm">
              <Building2 className="w-10 h-10 text-label3 mx-auto mb-3" />
              <p className="text-sm font-medium text-label">No lenders match your filters</p>
              <p className="text-xs text-label2 mt-1">Try adjusting your FICO or LTV requirements</p>
              <button onClick={clearFilters} className="mt-4 text-sm text-blue font-medium">
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filtered.map((lender) => {
                const pullThrough =
                  lender.loans_submitted > 0
                    ? Math.round((lender.loans_closed / lender.loans_submitted) * 100)
                    : 0;
                return (
                  <div
                    key={lender.id}
                    className="bg-white border border-black/[0.06] rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => {
                      if (!lender.isSample) router.push(`/lenders/${lender.id}`);
                    }}
                  >
                    <div className="flex items-start gap-4">
                      {/* Logo placeholder */}
                      <div className="w-12 h-12 rounded-xl bg-navy/[0.06] flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-navy/40" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[15px] font-semibold text-navy group-hover:text-blue transition-colors">
                            {lender.name}
                          </h3>
                          {lender.is_preferred && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                              <Star className="w-2.5 h-2.5 fill-gold" />
                              Preferred
                            </span>
                          )}
                          {lender.isSample && (
                            <span className="text-[10px] font-medium text-label3 bg-black/[0.04] px-2 py-0.5 rounded-full">
                              Sample
                            </span>
                          )}
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', CHANNEL_COLORS[lender.channel] ?? 'bg-label3/10 text-label2')}>
                            {CHANNELS[lender.channel] ?? lender.channel}
                          </span>
                        </div>

                        {/* Products */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {lender.products.slice(0, 6).map((p) => (
                            <span key={p} className="text-[10px] font-medium bg-black/[0.04] text-label2 px-2 py-0.5 rounded-md">
                              {p}
                            </span>
                          ))}
                          {lender.products.length > 6 && (
                            <span className="text-[10px] font-medium text-label3 px-1">
                              +{lender.products.length - 6} more
                            </span>
                          )}
                        </div>

                        {/* Specs row */}
                        <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-label3">Min FICO</span>
                            <span className="text-[12px] font-semibold text-navy">
                              {lender.min_fico === 0 ? 'None' : lender.min_fico}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-label3">Max LTV</span>
                            <span className="text-[12px] font-semibold text-navy">{lender.max_ltv}%</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-label3">Turnaround</span>
                            <span className="text-[12px] font-semibold text-navy">
                              {lender.avg_turnaround_days > 0 ? `~${lender.avg_turnaround_days}d` : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-label3">States</span>
                            <span className="text-[12px] font-semibold text-navy">{lender.licensed_states.length}</span>
                          </div>
                          {lender.loans_submitted > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] text-label3">Pull-through</span>
                              <span className={cn('text-[12px] font-semibold', pullThroughColor(pullThrough))}>
                                {pullThrough}%
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Notes */}
                        {lender.notes && (
                          <p className="text-[12px] text-label2 mt-2 italic line-clamp-1">&quot;{lender.notes}&quot;</p>
                        )}
                      </div>

                      {/* AE contact */}
                      <div className="flex-shrink-0 text-right space-y-1">
                        {lender.ae_name && (
                          <p className="text-[12px] font-medium text-label">{lender.ae_name}</p>
                        )}
                        {lender.ae_phone && (
                          <a
                            href={`tel:${lender.ae_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[11px] text-label2 hover:text-blue justify-end"
                          >
                            <Phone className="w-3 h-3" />
                            {formatPhone(lender.ae_phone)}
                          </a>
                        )}
                        {lender.ae_email && (
                          <a
                            href={`mailto:${lender.ae_email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[11px] text-label2 hover:text-blue justify-end"
                          >
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[140px]">{lender.ae_email}</span>
                          </a>
                        )}
                        {!lender.isSample && (
                          <div className="flex items-center gap-1 justify-end mt-2">
                            <span className="text-[11px] text-label3">{lender.loans_submitted} submitted · {lender.loans_closed} closed</span>
                            <ChevronRight className="w-3.5 h-3.5 text-label3 group-hover:text-blue transition-colors" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty state for org with no lenders */}
          {orgLenders.length === 0 && (
            <div className="mt-4 bg-white border border-dashed border-black/[0.12] rounded-2xl p-8 text-center">
              <Building2 className="w-8 h-8 text-label3 mx-auto mb-3" />
              <p className="text-sm font-medium text-label">No lenders added yet</p>
              <p className="text-xs text-label2 mt-1">
                Add your first wholesale relationship to start tracking performance and enabling scenario matching.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A95C] text-white text-sm font-medium mx-auto hover:bg-[#B08D3C] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Lender
              </button>
            </div>
          )}
        </>
      ) : (
        <LenderPerformanceTable lenders={allLenders} />
      )}

      {showAddModal && (
        <AddLenderModal onClose={() => setShowAddModal(false)} />
      )}
      {showScenarioMatcher && (
        <ScenarioMatcherModal
          lenders={allLenders}
          onClose={() => setShowScenarioMatcher(false)}
        />
      )}
    </div>
  );
}

// ---- Performance Table ----
function LenderPerformanceTable({ lenders }: { lenders: UnifiedLender[] }) {
  const sorted = [...lenders]
    .filter((l) => l.loans_submitted > 0)
    .sort((a, b) => b.loans_closed - a.loans_closed);

  if (sorted.length === 0) {
    return (
      <div className="bg-white border border-black/[0.06] rounded-2xl p-12 text-center shadow-sm">
        <AlertCircle className="w-8 h-8 text-label3 mx-auto mb-3" />
        <p className="text-sm font-medium text-label">No performance data yet</p>
        <p className="text-xs text-label2 mt-1">Submit loans to lenders to track approval and close rates.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/[0.06] rounded-2xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[0.06] bg-black/[0.02]">
            <th className="text-left px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Lender</th>
            <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Submitted</th>
            <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Closed</th>
            <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Pull-Through</th>
            <th className="text-right px-4 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Avg Days</th>
            <th className="text-right px-5 py-3 text-[11px] font-semibold text-label3 uppercase tracking-wide">Denial Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/[0.04]">
          {sorted.map((l) => {
            const pullThrough = Math.round((l.loans_closed / l.loans_submitted) * 100);
            const denialRate = 100 - pullThrough;
            return (
              <tr key={l.id} className="hover:bg-black/[0.01] transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    {l.is_preferred && <Star className="w-3.5 h-3.5 fill-gold text-gold flex-shrink-0" />}
                    <div>
                      <p className="font-medium text-navy text-[13px]">{l.name}</p>
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md', CHANNEL_COLORS[l.channel] ?? 'bg-black/[0.04] text-label2')}>
                        {CHANNELS[l.channel] ?? l.channel}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-mono text-label">{l.loans_submitted}</td>
                <td className="px-4 py-3.5 text-right text-[13px] font-mono text-label">{l.loans_closed}</td>
                <td className="px-4 py-3.5 text-right">
                  <span className={cn('text-[13px] font-mono font-semibold', pullThroughColor(pullThrough))}>
                    {pullThrough}%
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right text-[13px] font-mono text-label">
                  {l.avg_days_to_close > 0 ? `${l.avg_days_to_close}d` : '—'}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span className={cn('text-[13px] font-mono font-semibold', denialRate < 20 ? 'text-success' : denialRate < 40 ? 'text-warning' : 'text-danger')}>
                    {denialRate}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
