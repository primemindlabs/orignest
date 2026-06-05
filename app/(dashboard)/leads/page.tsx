import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Plus, Download, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { getTRIDStatus } from '@/lib/compliance/trid';
import { format } from 'date-fns';
import type { LeadStage } from '@/types';
import { StageFilter, LeadRow } from './leads-interactive';

export const metadata: Metadata = { title: 'Leads' };

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'Clear to Close',
  closed: 'Closed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

const STAGE_BADGE_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'gold'> = {
  new_inquiry: 'neutral',
  pre_qual: 'info',
  application: 'info',
  processing: 'info',
  underwriting: 'warning',
  conditional_approval: 'warning',
  clear_to_close: 'gold',
  closed: 'success',
  declined: 'danger',
  withdrawn: 'neutral',
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  conventional: 'Conv',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  jumbo: 'Jumbo',
  non_qm: 'Non-QM',
  heloc: 'HELOC',
  construction: 'Const',
  reverse: 'Reverse',
  commercial: 'Comm',
  dscr: 'DSCR',
};

interface SearchParams {
  q?: string;
  stage?: string;
  source?: string;
  loan_type?: string;
  page?: string;
}

const PAGE_SIZE = 25;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  let query = sb
    .from('leads')
    .select(
      'id, first_name, last_name, email, phone, stage, loan_type, loan_amount, lead_source, ai_score, assigned_to, created_at, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date',
      { count: 'exact' }
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (searchParams.q) {
    query = query.or(
      `first_name.ilike.%${searchParams.q}%,last_name.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`
    );
  }
  if (searchParams.stage) {
    query = query.eq('stage', searchParams.stage);
  }
  if (searchParams.source) {
    query = query.eq('lead_source', searchParams.source);
  }
  if (searchParams.loan_type) {
    query = query.eq('loan_type', searchParams.loan_type);
  }

  const { data: leads, count } = await query;

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Get distinct sources for filter chips
  const { data: sourcesData } = await sb
    .from('leads')
    .select('lead_source')
    .eq('org_id', orgId)
    .not('lead_source', 'is', null);

  const sources = [...new Set((sourcesData ?? []).map((s) => s.lead_source).filter(Boolean))];

  function buildUrl(params: Partial<SearchParams>): string {
    const merged = { ...searchParams, ...params };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && k !== 'page') qs.set(k, v);
      if (k === 'page' && v !== '1') qs.set(k, v);
    }
    return `/leads${qs.toString() ? '?' + qs.toString() : ''}`;
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Leads</h1>
          <p className="text-label-2 text-sm mt-0.5">{total} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors">
            <Download size={14} />
            <span>Export</span>
          </button>
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors shadow-sm"
          >
            <Plus size={14} />
            Add Lead
          </Link>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div className="bg-surface rounded-card shadow-card border border-border p-4 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <form className="flex-1 min-w-[200px] max-w-sm">
          <input
            name="q"
            defaultValue={searchParams.q}
            placeholder="Search leads..."
            className="w-full h-8 px-3 rounded-[8px] bg-fill border border-border text-sm text-black placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-blue/30 focus:border-blue"
          />
        </form>

        {/* Stage filter */}
        <StageFilter stages={Object.entries(STAGE_LABELS)} />

        {/* Loan type chips */}
        <div className="flex flex-wrap gap-1.5">
          {['conventional', 'fha', 'va', 'jumbo'].map((lt) => (
            <Link
              key={lt}
              href={buildUrl({ loan_type: searchParams.loan_type === lt ? undefined : lt, page: '1' })}
              className={`h-7 px-2.5 rounded-full text-xs font-medium transition-colors ${
                searchParams.loan_type === lt
                  ? 'bg-blue text-white'
                  : 'bg-fill text-label-2 hover:bg-border'
              }`}
            >
              {LOAN_TYPE_LABELS[lt]}
            </Link>
          ))}
        </div>

        {/* Active filter count */}
        {(searchParams.q || searchParams.stage || searchParams.loan_type) && (
          <Link
            href="/leads"
            className="text-xs text-blue hover:underline ml-auto"
          >
            Clear filters
          </Link>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-4 py-3">
                  Borrower
                </th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Stage
                </th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Loan Type
                </th>
                <th className="text-right text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Amount
                </th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Source
                </th>
                <th className="text-center text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  AI Score
                </th>
                <th className="text-center text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  TRID
                </th>
                <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(leads ?? []).map((lead) => {
                const trid = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);
                const hasTridIssue =
                  trid.le === 'overdue' || trid.le === 'due_today' || trid.cd === 'overdue' || trid.cd === 'blocked';

                return (
                  <LeadRow key={lead.id} href={`/leads/${lead.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-semibold text-blue">
                            {lead.first_name?.[0]}{lead.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-black">
                            {lead.first_name} {lead.last_name}
                          </p>
                          <p className="text-[11px] text-label-2">{lead.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant={STAGE_BADGE_VARIANT[lead.stage as LeadStage] ?? 'neutral'}
                        size="sm"
                      >
                        {STAGE_LABELS[lead.stage] ?? lead.stage}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-sm text-label-2">
                      {lead.loan_type ? (LOAN_TYPE_LABELS[lead.loan_type] ?? lead.loan_type) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-mono tabular-nums text-black">
                      {lead.loan_amount
                        ? `$${lead.loan_amount.toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-label-2">
                      {lead.lead_source ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {lead.ai_score !== null ? (
                        <span
                          className={`text-sm font-mono font-semibold tabular-nums ${
                            lead.ai_score >= 70
                              ? 'text-green'
                              : lead.ai_score >= 40
                              ? 'text-orange'
                              : 'text-red'
                          }`}
                        >
                          {lead.ai_score}
                        </span>
                      ) : (
                        <span className="text-label-3 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {hasTridIssue ? (
                        <AlertTriangle size={14} className="text-red inline" />
                      ) : lead.application_submitted_at ? (
                        <span className="text-green text-xs">✓</span>
                      ) : (
                        <span className="text-label-3 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-label-2">
                      {lead.created_at
                        ? format(new Date(lead.created_at), 'MMM d, yyyy')
                        : '—'}
                    </td>
                  </LeadRow>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-label-2">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              {page > 1 && (
                <Link
                  href={buildUrl({ page: String(page - 1) })}
                  className="h-7 px-3 rounded-[6px] text-xs font-medium bg-fill hover:bg-border text-black transition-colors"
                >
                  Previous
                </Link>
              )}
              <span className="h-7 px-3 rounded-[6px] text-xs font-medium bg-blue text-white flex items-center">
                {page}
              </span>
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="h-7 px-3 rounded-[6px] text-xs font-medium bg-fill hover:bg-border text-black transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
