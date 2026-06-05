'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { ConditionsChecklist } from './ConditionsChecklist';
import Link from 'next/link';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  loan_type: string | null;
  stage: string;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  profiles: { first_name: string; last_name: string } | null;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
}

interface KPIs {
  filesInProcessing: number;
  totalOpenConditions: number;
  avgDaysInProcessing: number;
  ctcThisWeek: number;
}

interface Props {
  leads: Lead[];
  openByLead: Record<string, number>;
  kpis: KPIs;
  profiles: Profile[];
}

const STAGE_LABELS: Record<string, string> = {
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'CTC',
};

const STAGE_ORDER = ['processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

const STAGE_BADGE: Record<string, 'info' | 'warning' | 'gold' | 'neutral'> = {
  processing: 'info',
  underwriting: 'warning',
  conditional_approval: 'warning',
  clear_to_close: 'gold',
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  jumbo: 'Jumbo',
  non_qm: 'Non-QM',
  heloc: 'HELOC',
  construction: 'Construction',
  reverse: 'Reverse',
  dscr: 'DSCR',
  commercial: 'Commercial',
};

function daysIn(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

export function ProcessingWorkspace({ leads, openByLead, kpis, profiles }: Props) {
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [filterLO, setFilterLO] = useState<string>('');
  const [filterStage, setFilterStage] = useState<string>('');
  const [filterLoanType, setFilterLoanType] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = [...leads];

    if (filterLO) list = list.filter((l) => l.assigned_to === filterLO);
    if (filterStage) list = list.filter((l) => l.stage === filterStage);
    if (filterLoanType) list = list.filter((l) => l.loan_type === filterLoanType);
    if (overdueOnly) list = list.filter((l) => daysIn(l.created_at) > 30);

    // Default sort: most open conditions first
    list.sort((a, b) => (openByLead[b.id] ?? 0) - (openByLead[a.id] ?? 0));

    return list;
  }, [leads, openByLead, filterLO, filterStage, filterLoanType, overdueOnly]);

  return (
    <div className="space-y-5 max-w-[1400px] animate-fade-in">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">Processing</h1>
        <p className="text-label-2 text-sm mt-0.5">Manage in-process loan files and conditions</p>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <KPICard
          label="Files in Processing"
          value={kpis.filesInProcessing}
          color="blue"
        />
        <KPICard
          label="Open Conditions"
          value={kpis.totalOpenConditions}
          color={kpis.totalOpenConditions > 20 ? 'red' : 'orange'}
          alert={kpis.totalOpenConditions > 20}
        />
        <KPICard
          label="Avg Days in Processing"
          value={kpis.avgDaysInProcessing}
          suffix="days"
          color={kpis.avgDaysInProcessing > 21 ? 'orange' : 'green'}
        />
        <KPICard
          label="CTC This Week"
          value={kpis.ctcThisWeek}
          color="gold"
        />
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────── */}
      <div className="bg-surface rounded-card shadow-card border border-border p-3 flex flex-wrap gap-2 items-center">
        <SlidersHorizontal size={14} className="text-label-3" />

        <select
          value={filterLO}
          onChange={(e) => setFilterLO(e.target.value)}
          className="h-8 px-2.5 rounded-[8px] bg-fill border border-border text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue/30"
        >
          <option value="">All LOs</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.first_name} {p.last_name}
            </option>
          ))}
        </select>

        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="h-8 px-2.5 rounded-[8px] bg-fill border border-border text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue/30"
        >
          <option value="">All Stages</option>
          {STAGE_ORDER.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={filterLoanType}
          onChange={(e) => setFilterLoanType(e.target.value)}
          className="h-8 px-2.5 rounded-[8px] bg-fill border border-border text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue/30"
        >
          <option value="">All Loan Types</option>
          {Object.entries(LOAN_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 cursor-pointer select-none ml-1">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-label-2">Overdue only</span>
        </label>

        {(filterLO || filterStage || filterLoanType || overdueOnly) && (
          <button
            onClick={() => { setFilterLO(''); setFilterStage(''); setFilterLoanType(''); setOverdueOnly(false); }}
            className="text-xs text-blue hover:underline ml-auto"
          >
            Clear filters
          </button>
        )}

        <span className="text-xs text-label-3 ml-auto">{filtered.length} files</span>
      </div>

      {/* ── Files Table ──────────────────────────────────────────────── */}
      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-fill/30">
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-4 py-3 w-[200px]">
                Borrower
              </th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                Loan Type
              </th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                LO
              </th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                Stage
              </th>
              <th className="text-center text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                Days In
              </th>
              <th className="text-center text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                Open Conditions
              </th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                Last Updated
              </th>
              <th className="text-right text-[11px] font-semibold text-label-2 uppercase tracking-wide px-4 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-label-3">
                  No files in processing
                </td>
              </tr>
            ) : (
              filtered.map((lead) => {
                const isExpanded = expandedLead === lead.id;
                const openCount = openByLead[lead.id] ?? 0;
                const days = daysIn(lead.created_at);

                return (
                  <>
                    <tr
                      key={lead.id}
                      className={`transition-colors cursor-pointer ${isExpanded ? 'bg-fill/40' : 'hover:bg-fill/30'}`}
                      onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-label-3 flex-shrink-0" />
                          ) : (
                            <ChevronRight size={14} className="text-label-3 flex-shrink-0" />
                          )}
                          <div className="w-7 h-7 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-semibold text-blue">
                              {lead.first_name[0]}{lead.last_name[0]}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-black">
                            {lead.first_name} {lead.last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {lead.loan_type ? (
                          <Badge variant="neutral" size="sm">
                            {LOAN_TYPE_LABELS[lead.loan_type] ?? lead.loan_type}
                          </Badge>
                        ) : (
                          <span className="text-label-3 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-label-2">
                        {lead.profiles
                          ? `${lead.profiles.first_name} ${lead.profiles.last_name}`
                          : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={STAGE_BADGE[lead.stage] ?? 'neutral'}
                          size="sm"
                          dot
                        >
                          {STAGE_LABELS[lead.stage] ?? lead.stage}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-sm font-mono tabular-nums font-semibold ${
                            days > 30 ? 'text-red' : days > 21 ? 'text-orange' : 'text-label-2'
                          }`}
                        >
                          {days}d
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {openCount > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 text-sm font-semibold ${
                              openCount >= 5 ? 'text-red' : openCount >= 3 ? 'text-orange' : 'text-label-2'
                            }`}
                          >
                            {openCount >= 5 && <AlertCircle size={12} />}
                            {openCount}
                          </span>
                        ) : (
                          <span className="text-green text-sm">✓</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-label-2">
                        {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/processing/${lead.id}`}
                          className="text-xs text-blue hover:underline mr-3"
                        >
                          Full View
                        </Link>
                      </td>
                    </tr>

                    {/* Inline expanded conditions */}
                    {isExpanded && (
                      <tr key={`${lead.id}-expanded`}>
                        <td colSpan={8} className="px-6 pb-5 pt-2 bg-fill/20">
                          <ConditionsChecklist leadId={lead.id} inline />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPICard({
  label,
  value,
  suffix,
  color,
  alert,
}: {
  label: string;
  value: number;
  suffix?: string;
  color: 'blue' | 'green' | 'orange' | 'red' | 'gold';
  alert?: boolean;
}) {
  const colorClass: Record<typeof color, string> = {
    blue: 'text-blue',
    green: 'text-green',
    orange: 'text-orange',
    red: 'text-red',
    gold: 'text-gold',
  };

  return (
    <div className="bg-surface rounded-card shadow-card border border-border p-4">
      <p className="text-[11px] font-medium text-label-2 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        {alert && <AlertCircle size={14} className="text-red mb-0.5" />}
        <span className={`text-[28px] font-light tabular-nums ${colorClass[color]}`} style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}>
          {value}
        </span>
        {suffix && <span className="text-sm text-label-3">{suffix}</span>}
      </div>
    </div>
  );
}
