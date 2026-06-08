'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2, SlidersHorizontal, AlertCircle, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  loan_type: string | null;
  loan_amount: number | null;
  stage: string;
  created_at: string;
  closing_date: string | null;
  org_id: string;
}

interface Assignment {
  id: string;
  org_id: string;
  orgName: string;
  status: 'pending' | 'active' | 'suspended';
  permissions: Record<string, boolean>;
}

interface LOProfile {
  id: string;
  first_name: string;
  last_name: string;
  org_id: string;
}

interface OrgInfo {
  id: string;
  name: string;
  nmls_company_id: string | null;
}

interface Props {
  assignments: Assignment[];
  leads: Lead[];
  openByLead: Record<string, number>;
  orgMap: Record<string, OrgInfo>;
  loProfiles: LOProfile[];
}

const STAGE_LABELS: Record<string, string> = {
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'CTC',
};

const STAGE_BADGE: Record<string, 'info' | 'warning' | 'gold' | 'neutral'> = {
  application: 'info',
  processing: 'info',
  underwriting: 'warning',
  conditional_approval: 'warning',
  clear_to_close: 'gold',
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  conventional: 'Conv.',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  jumbo: 'Jumbo',
  non_qm: 'Non-QM',
  dscr: 'DSCR',
  commercial: 'Comm.',
};

function daysIn(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

export function ProcessorDashboard({
  assignments,
  leads,
  openByLead,
  orgMap,
  loProfiles,
}: Props) {
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const activeOrgs = assignments.filter((a) => a.status === 'active');
  const pendingCount = assignments.filter((a) => a.status === 'pending').length;

  const filtered = useMemo(() => {
    let list = [...leads];
    if (selectedOrg) list = list.filter((l) => l.org_id === selectedOrg);
    if (selectedStage) list = list.filter((l) => l.stage === selectedStage);
    if (overdueOnly) list = list.filter((l) => (openByLead[l.id] ?? 0) > 0 && daysIn(l.created_at) > 14);
    return list.sort((a, b) => (openByLead[b.id] ?? 0) - (openByLead[a.id] ?? 0));
  }, [leads, selectedOrg, selectedStage, overdueOnly, openByLead]);

  return (
    <div className="max-w-[1400px] space-y-5 animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Processor Dashboard</h1>
          <p className="text-label-2 text-sm mt-0.5">
            Working across {activeOrgs.length} {activeOrgs.length === 1 ? 'brokerage' : 'brokerages'}
            {pendingCount > 0 && (
              <> · <Link href="/processor/organizations" className="text-orange hover:underline">{pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}</Link></>
            )}
          </p>
        </div>
        <Link
          href="/processor/organizations"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors"
        >
          <Building2 size={14} />
          My Organizations
        </Link>
      </div>

      {/* ── Org tiles ─────────────────────────────────────────────────── */}
      {activeOrgs.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedOrg('')}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
              !selectedOrg
                ? 'bg-navy text-white'
                : 'bg-fill text-label-2 hover:bg-border'
            }`}
          >
            All orgs
            <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold ${!selectedOrg ? 'bg-white/20 text-white' : 'bg-label-2/20 text-label-2'}`}>
              {leads.length}
            </span>
          </button>
          {activeOrgs.map((a) => {
            const orgLeads = leads.filter((l) => l.org_id === a.org_id);
            return (
              <button
                key={a.org_id}
                onClick={() => setSelectedOrg(selectedOrg === a.org_id ? '' : a.org_id)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                  selectedOrg === a.org_id
                    ? 'bg-blue text-white'
                    : 'bg-fill text-label-2 hover:bg-border'
                }`}
              >
                {a.orgName}
                <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold ${selectedOrg === a.org_id ? 'bg-white/20 text-white' : 'bg-label-2/20 text-label-2'}`}>
                  {orgLeads.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-card shadow-card border border-border p-3 flex flex-wrap gap-2 items-center">
        <SlidersHorizontal size={14} className="text-label-3" />

        <select
          value={selectedStage}
          onChange={(e) => setSelectedStage(e.target.value)}
          className="h-8 px-2.5 rounded-[8px] bg-fill border border-border text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue/30"
        >
          <option value="">All Stages</option>
          {Object.entries(STAGE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-label-2">Overdue conditions</span>
        </label>

        {(selectedOrg || selectedStage || overdueOnly) && (
          <button
            onClick={() => { setSelectedOrg(''); setSelectedStage(''); setOverdueOnly(false); }}
            className="text-xs text-blue hover:underline ml-auto"
          >
            Clear filters
          </button>
        )}

        <span className="text-xs text-label-3 ml-auto">{filtered.length} files</span>
      </div>

      {/* ── File Table ────────────────────────────────────────────────── */}
      {leads.length === 0 ? (
        <EmptyState
          icon={<Building2 size={24} className="text-label-3" />}
          title="No active files"
          description="When a brokerage assigns you to a loan file, it will appear here. Check My Organizations to accept pending invitations."
          actionLabel="View Organizations"
          actionHref="/processor/organizations"
        />
      ) : (
        <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-fill/30">
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-4 py-3">
                  Borrower
                </th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Brokerage
                </th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Loan
                </th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Stage
                </th>
                <th className="text-center text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Days In
                </th>
                <th className="text-center text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Open Conds
                </th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Age
                </th>
                <th className="text-right text-[11px] font-semibold text-label-2 uppercase tracking-wide px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-label-3">
                    No files match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => {
                  const openCount = openByLead[lead.id] ?? 0;
                  const days = daysIn(lead.created_at);
                  const org = orgMap[lead.org_id];

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-fill/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
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
                        <span className="text-xs font-medium text-label-2 bg-fill px-2 py-1 rounded-full">
                          {org?.name ?? '—'}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <div className="space-y-0.5">
                          {lead.loan_type && (
                            <Badge variant="neutral" size="sm">
                              {LOAN_TYPE_LABELS[lead.loan_type] ?? lead.loan_type}
                            </Badge>
                          )}
                          {lead.loan_amount && (
                            <p className="text-[11px] font-mono text-label-2 tabular-nums">
                              ${lead.loan_amount.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <Badge variant={STAGE_BADGE[lead.stage] ?? 'neutral'} size="sm" dot>
                          {STAGE_LABELS[lead.stage] ?? lead.stage}
                        </Badge>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-sm font-mono font-semibold tabular-nums ${
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

                      <td className="px-3 py-3 text-xs text-label-3">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/processing/${lead.id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue hover:underline"
                        >
                          Open <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
