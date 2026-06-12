'use client';

/** Phase 74 — tabbed pipeline list: Active | Needs attention | Pre-approvals |
 * Applications | Closed. Money + urgency visible per row. Real columns only. */
import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { format, differenceInCalendarDays } from 'date-fns';
import { IconSearch, IconBuildingBank, IconCircleCheck, IconClipboardX, IconClockPause, IconCalendarStats } from '@tabler/icons-react';
import { formatMortgageEnum, LOAN_PURPOSE_LABELS, LOAN_TYPE_LABELS, LEAD_SOURCE_LABELS } from '@/lib/formatters/mortgage';
import { StageBadge } from './StageBadge';
import { LeadAlertTag, type PipelineLead } from './LeadAlertTag';
import { CloseProbabilityBar } from '@/components/pipeline-probability/CloseProbabilityBar';
import { IntelligenceRow } from '@/components/pipeline/IntelligenceRow';
import { SourceBadge } from '@/components/leads/SourceBadge';

const usd0 = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtVol = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`);

function hasAlert(l: PipelineLead): boolean {
  if (l.outstanding_conditions_count > 0) return true;
  const t = l.last_contacted_at ?? l.stage_changed_at;
  if (t && differenceInCalendarDays(new Date(), new Date(t)) > 5) return true;
  return false;
}

const ACTIVE_STAGES = [
  { key: 'all', label: 'All' }, { key: 'new_inquiry', label: 'New inquiry' }, { key: 'pre_qual', label: 'Pre-qual' },
  { key: 'application', label: 'Application' }, { key: 'processing', label: 'Processing' }, { key: 'underwriting', label: 'Underwriting' },
  { key: 'conditional_approval', label: 'Cond.' }, { key: 'clear_to_close', label: 'CTC' },
];

function Row({ lead, compRate, closed }: { lead: PipelineLead; compRate: number; closed?: boolean }) {
  const commission = (lead.loan_amount ?? 0) * (compRate / 100);
  return (
    <Link href={`/leads/${lead.id}`} className="grid grid-cols-[2.2fr_1fr_1.2fr_1fr] gap-2 px-4 py-3 border-b border-[var(--color-border-tertiary)] items-center hover:bg-[#fdfbf7] transition-colors text-sm last:border-b-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-full bg-[#F5EFE0] border-2 border-[#C9A95C] flex items-center justify-center text-[10px] font-semibold text-[#8A6310] flex-shrink-0">{lead.first_name?.[0]}{lead.last_name?.[0]}</div>
        <div className="min-w-0">
          <p className="font-medium text-black truncate">{lead.first_name} {lead.last_name}</p>
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{formatMortgageEnum(lead.loan_purpose, LOAN_PURPOSE_LABELS) ?? '—'} · {formatMortgageEnum(lead.lead_source, LEAD_SOURCE_LABELS) ?? 'Direct'}</p>
          {lead.referral_source && <div className="mt-1"><SourceBadge source={lead.referral_source} detail={lead.referral_source_detail} size="sm" /></div>}
          {lead.intel && <IntelligenceRow scores={lead.intel} />}
        </div>
      </div>
      <div>
        <p className="font-medium text-black">{lead.loan_amount ? `$${lead.loan_amount.toLocaleString()}` : '—'}</p>
        <p className="text-[11px] text-[var(--color-text-secondary)]">{formatMortgageEnum(lead.loan_type, LOAN_TYPE_LABELS) ?? '—'}</p>
      </div>
      <div>
        <StageBadge stage={lead.stage} />
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {lead.closing_date && <span className="text-[11px] text-[var(--color-text-secondary)]">{format(new Date(lead.closing_date), 'MMM d')}</span>}
          {!closed && <LeadAlertTag lead={lead} />}
        </div>
        {!closed && typeof lead.close_probability === 'number' && (
          <div className="mt-1.5">
            <CloseProbabilityBar score={lead.close_probability} factors={lead.prob_factors} compact />
          </div>
        )}
      </div>
      <div className="text-right">
        {lead.loan_amount ? (<><p className="font-medium text-[#8A6310]">{usd0(commission)}</p><p className="text-[11px] text-[var(--color-text-secondary)]">{compRate}% {closed ? 'earned' : 'comp'}</p></>) : <p className="text-[11px] text-[var(--color-text-secondary)]">—</p>}
      </div>
    </Link>
  );
}

const HeaderRow = () => (
  <div className="grid grid-cols-[2.2fr_1fr_1.2fr_1fr] gap-2 px-4 py-2 bg-[var(--color-background-secondary)] border-b border-[var(--color-border-tertiary)] text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.05em]">
    <div>Borrower</div><div>Loan · type</div><div>Stage · close</div><div className="text-right">Est. commission</div>
  </div>
);

const Empty = ({ icon: Icon, title, sub }: { icon: typeof IconBuildingBank; title: string; sub: string }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Icon size={36} className="text-[var(--color-border-secondary)] mb-3" />
    <p className="text-sm font-medium text-black mb-1">{title}</p>
    <p className="text-xs text-[var(--color-text-secondary)]">{sub}</p>
  </div>
);

export function PipelineTabsView({ active, closed, compRate }: { active: PipelineLead[]; closed: PipelineLead[]; compRate: number }) {
  const attention = active.filter(hasAlert);
  const preApprovals = active.filter((l) => l.stage === 'pre_qual');
  const applications = active.filter((l) => ['application', 'processing'].includes(l.stage));
  const TABS = [
    { key: 'active', label: 'Active', count: active.length, alert: false },
    { key: 'attention', label: 'Needs attention', count: attention.length, alert: true },
    { key: 'preapproval', label: 'Pre-approvals', count: preApprovals.length, alert: false },
    { key: 'application', label: 'Applications', count: applications.length, alert: false },
    { key: 'closed', label: 'Closed', count: closed.length, alert: false },
  ];
  // Phase 99 — honor /pipeline?stage=<name> from the funnel chart click.
  const urlStage = useSearchParams().get('stage');
  const [tab, setTab] = useState(urlStage === 'closed' ? 'closed' : 'active');
  const [stage, setStage] = useState(urlStage && urlStage !== 'closed' ? urlStage : 'all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('close');

  const activeFiltered = useMemo(() => {
    let r = stage === 'all' ? active : active.filter((l) => l.stage === stage);
    if (q) { const s = q.toLowerCase(); r = r.filter((l) => `${l.first_name} ${l.last_name}`.toLowerCase().includes(s)); }
    const sorted = [...r];
    if (sort === 'close') sorted.sort((a, b) => (a.closing_date ?? '9999').localeCompare(b.closing_date ?? '9999'));
    else if (sort === 'amount') sorted.sort((a, b) => (b.loan_amount ?? 0) - (a.loan_amount ?? 0));
    else if (sort === 'activity') sorted.sort((a, b) => (b.last_contacted_at ?? b.created_at).localeCompare(a.last_contacted_at ?? a.created_at));
    return sorted;
  }, [active, stage, q, sort]);

  const stageCount = (k: string) => (k === 'all' ? active.length : active.filter((l) => l.stage === k).length);
  const closedByMonth = useMemo(() => {
    const m: Record<string, PipelineLead[]> = {};
    for (const l of closed) { const d = l.closing_date ? new Date(l.closing_date) : new Date(l.created_at); const key = format(d, 'MMMM yyyy'); (m[key] ??= []).push(l); }
    return Object.entries(m);
  }, [closed]);

  return (
    <div className="hidden md:block bg-white border border-[var(--color-border-tertiary)] rounded-[12px] overflow-hidden">
      {/* Tab row */}
      <div className="flex border-b border-[var(--color-border-tertiary)] overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-[#C9A95C] text-[#C9A95C] font-medium' : 'border-transparent text-[var(--color-text-secondary)] hover:text-black'}`}>
            {t.label}
            <span className={`ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] ${t.alert && t.count > 0 ? 'bg-[#C4724A15] text-[#C4724A]' : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)]'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ACTIVE */}
      {tab === 'active' && (active.length === 0 ? <Empty icon={IconBuildingBank} title="No active loans" sub="Add your first lead to get started." /> : (
        <>
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[var(--color-border-tertiary)] overflow-x-auto">
            {ACTIVE_STAGES.map((s) => (
              <button key={s.key} onClick={() => setStage(s.key)} className={`px-3 py-1 rounded-full text-xs border transition-colors whitespace-nowrap ${stage === s.key ? 'bg-[#C9A95C] border-[#C9A95C] text-white font-medium' : 'bg-[var(--color-background-secondary)] border-[var(--color-border-tertiary)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-secondary)]'}`}>
                {s.label} <span className="opacity-70 ml-0.5">{stageCount(s.key)}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border-tertiary)]">
            <div className="relative flex-1">
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search borrower…" className="w-full h-8 pl-8 pr-3 text-sm bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#C9A95C] text-black placeholder:text-[var(--color-text-secondary)]" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 px-2 text-xs bg-[var(--color-background-secondary)] border border-[var(--color-border-tertiary)] rounded-[8px] text-[var(--color-text-secondary)]">
              <option value="close">Close date</option><option value="amount">Loan amount</option><option value="activity">Last activity</option>
            </select>
          </div>
          <HeaderRow />
          {activeFiltered.map((l) => <Row key={l.id} lead={l} compRate={compRate} />)}
          <div className="grid grid-cols-[2.2fr_1fr_1.2fr_1fr] gap-2 px-4 py-2.5 bg-[var(--color-background-secondary)] border-t border-[var(--color-border-tertiary)] text-xs text-[var(--color-text-secondary)]">
            <div>{activeFiltered.length} of {active.length} loans</div>
            <div className="font-medium text-black">{fmtVol(activeFiltered.reduce((s, l) => s + (l.loan_amount ?? 0), 0))}</div>
            <div />
            <div className="text-right font-medium text-[#8A6310]">{usd0(activeFiltered.reduce((s, l) => s + (l.loan_amount ?? 0) * (compRate / 100), 0))} shown</div>
          </div>
        </>
      ))}

      {/* NEEDS ATTENTION */}
      {tab === 'attention' && (attention.length === 0 ? <Empty icon={IconCircleCheck} title="Everything looks good" sub="No loans need attention right now." /> : (
        <>
          {[{ key: 'conditions', label: 'Outstanding conditions', icon: IconClipboardX, leads: active.filter((l) => l.outstanding_conditions_count > 0) },
            { key: 'stalled', label: 'No activity in 5+ days', icon: IconClockPause, leads: active.filter((l) => { const t = l.last_contacted_at ?? l.stage_changed_at; return t && differenceInCalendarDays(new Date(), new Date(t)) > 5 && !['closed', 'funded', 'withdrawn', 'declined'].includes(l.stage) && l.outstanding_conditions_count === 0; }) },
          ].filter((g) => g.leads.length > 0).map((g) => (
            <div key={g.key}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)]">
                <g.icon size={15} className="text-[#C4724A]" /><span className="text-sm font-medium text-black">{g.label}</span>
                <span className="text-xs text-[#C4724A] bg-[#C4724A15] px-1.5 py-0.5 rounded-full">{g.leads.length}</span>
              </div>
              {g.leads.map((l) => <Row key={l.id} lead={l} compRate={compRate} />)}
            </div>
          ))}
        </>
      ))}

      {/* PRE-APPROVALS */}
      {tab === 'preapproval' && (preApprovals.length === 0 ? <Empty icon={IconBuildingBank} title="No pre-approvals" sub="Pre-qual leads appear here." /> : <><HeaderRow />{preApprovals.map((l) => <Row key={l.id} lead={l} compRate={compRate} />)}</>)}

      {/* APPLICATIONS */}
      {tab === 'application' && (applications.length === 0 ? <Empty icon={IconBuildingBank} title="No applications in process" sub="Submitted 1003s appear here." /> : <><HeaderRow />{applications.map((l) => <Row key={l.id} lead={l} compRate={compRate} />)}</>)}

      {/* CLOSED */}
      {tab === 'closed' && (closed.length === 0 ? <Empty icon={IconCalendarStats} title="No closed loans yet" sub="Funded loans appear here." /> : closedByMonth.map(([month, leads], idx) => (
        <details key={month} open={idx === 0}>
          <summary className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] cursor-pointer text-sm font-medium text-black">
            <span>{month}</span>
            <span className="text-xs font-normal text-[var(--color-text-secondary)]">{fmtVol(leads.reduce((s, l) => s + (l.loan_amount ?? 0), 0))} · {leads.length} loans · <span className="text-[#8A6310]">{usd0(leads.reduce((s, l) => s + (l.loan_amount ?? 0) * (compRate / 100), 0))} earned</span></span>
          </summary>
          <HeaderRow />
          {leads.map((l) => <Row key={l.id} lead={l} compRate={compRate} closed />)}
        </details>
      )))}
    </div>
  );
}
