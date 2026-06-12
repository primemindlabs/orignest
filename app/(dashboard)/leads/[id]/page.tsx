import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import {
  Phone,
  Mail,
  MessageSquare,
  FileText,
  Clock,
  ArrowLeft,
  AlertTriangle,
  FolderOpen,
  ChevronRight,
  Activity as ActivityIcon,
} from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/Badge';
import { EnrollCreditRepairButton } from './EnrollCreditRepairButton';
import { AIDraftsPanel } from '@/components/loanFile/AIDraftsPanel';
import { ScenarioAIPanel } from '@/components/scenarioAI/ScenarioAIPanel';
import { AssignTaskButton } from '@/components/loanFile/AssignTaskButton';
import { CreditMonitoringButton } from '@/components/leads/CreditMonitoringButton';
import { PreApprovalCertButton } from '@/components/loan/PreApprovalCertButton';
import { LoanOpsPanel } from '@/components/loan/LoanOpsPanel';
import { InvestorEntityPanel } from '@/components/loan/InvestorEntityPanel';
import { DNCStatusBadge } from '@/components/loan/DNCStatusBadge';
import { BorrowerEngagementBanner } from '@/components/ghost/BorrowerEngagementBanner';
import { TcpaWindowBadge } from '@/components/loan/TcpaWindowBadge';
import { LeadToolsMenu } from './LeadToolsMenu';
import { ConditionsManager, type Condition } from '@/components/loan/ConditionsManager';
import { Smart1003Form } from './application/Smart1003Form';
import { IncomeHubClient } from '@/app/(dashboard)/loans/[loanId]/income/IncomeHubClient';
import {
  formatMortgageEnum,
  LOAN_TYPE_LABELS,
  LOAN_PURPOSE_LABELS,
  LEAD_SOURCE_LABELS,
  PROPERTY_TYPE_LABELS,
  OCCUPANCY_LABELS,
} from '@/lib/formatters/mortgage';
import { TRIDTimeline } from '@/components/compliance/TRIDTimeline';
import { getTRIDStatus } from '@/lib/compliance/trid';
import { maskSSN } from '@/lib/compliance/encryption';
import { format, formatDistanceToNow } from 'date-fns';
import type { LeadStage } from '@/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Lead Detail' };

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Conditional Approval',
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

const CHANNEL_LABEL: Record<string, string> = { sms: 'SMS', email: 'Email', call: 'Call', note: 'Note' };

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();

  const [{ data: lead }, { data: profile }, { data: activities }, { data: documents }, { data: notes }] =
    await Promise.all([
      sb.from('leads').select('*').eq('id', params.id).eq('org_id', orgId).maybeSingle(),
      sb.from('profiles').select('role').eq('clerk_user_id', userId).maybeSingle(),
      sb
        .from('lead_activities')
        .select('*')
        .eq('lead_id', params.id)
        .order('created_at', { ascending: false })
        .limit(50),
      sb
        .from('documents')
        .select('*')
        .eq('lead_id', params.id)
        .order('created_at', { ascending: false }),
      sb
        .from('lead_notes')
        .select('id, content, is_private, created_at, profiles:author_id ( first_name, last_name )')
        .eq('lead_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

  if (!lead) notFound();

  const role = profile?.role ?? 'loan_officer';
  const canViewPII = role === 'admin' || role === 'branch_manager';
  const activeTab = searchParams.tab ?? 'overview';

  const trid = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);
  const { data: orgRow } = await sb.from('organizations').select('channel').eq('id', orgId).maybeSingle();
  const isInvestorLoan = ['dscr', 'commercial', 'bridge', 'construction'].some((t) =>
    (lead.loan_type ?? '').toLowerCase().includes(t)
  );
  const isConstructionLoan = (lead.loan_type ?? '').toLowerCase().includes('construction');
  const hasTridIssue =
    trid.le === 'overdue' || trid.le === 'due_today' || trid.cd === 'overdue' || trid.cd === 'blocked';

  // LTV with fallback derivation (Fix 12)
  const displayLtv =
    lead.ltv != null
      ? `${Number(lead.ltv).toFixed(1)}%`
      : lead.loan_amount && lead.down_payment
      ? `${(((lead.loan_amount - lead.down_payment) / lead.loan_amount) * 100).toFixed(1)}%`
      : null;

  // ── Per-tab lazy data (kept off the default Overview view to avoid cost / side effects) ──
  let conditions: Condition[] = [];
  let communications: {
    id: string;
    channel: string | null;
    direction: string | null;
    subject: string | null;
    body: string | null;
    sent_at: string | null;
    created_at: string;
  }[] = [];
  let appSeed: { values: Record<string, unknown>; status: string } | null = null;

  if (activeTab === 'conditions') {
    const { data } = await sb
      .from('loan_conditions')
      .select('id, condition_text, category, priority, status, due_date, is_agent_visible')
      .eq('lead_id', params.id)
      .order('created_at', { ascending: true });
    conditions = (data as Condition[]) ?? [];
  }

  if (activeTab === 'communications') {
    const { data } = await sb
      .from('communications')
      .select('id, channel, direction, subject, body, sent_at, created_at')
      .eq('lead_id', params.id)
      .order('created_at', { ascending: false })
      .limit(100);
    communications = data ?? [];
  }

  if (activeTab === 'application') {
    // Mirror the standalone /application route: load latest draft, create one if none.
    let { data: app } = await sb
      .from('loan_applications')
      .select('status, loan_data, property_data, borrower_data, employment_data, declarations_data')
      .eq('lead_id', params.id)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!app) {
      const { data: created } = await sb
        .from('loan_applications')
        .insert({ org_id: orgId, lead_id: params.id, application_type: 'residential' })
        .select('status, loan_data, property_data, borrower_data, employment_data, declarations_data')
        .single();
      app = created;
    }

    const sectionData = app
      ? {
          ...(app.loan_data as Record<string, unknown>),
          ...(app.property_data as Record<string, unknown>),
          ...(app.borrower_data as Record<string, unknown>),
          ...(app.employment_data as Record<string, unknown>),
          ...(app.declarations_data as Record<string, unknown>),
        }
      : {};

    appSeed = {
      values: {
        loan_type: lead.loan_type ?? '',
        loan_purpose: lead.loan_purpose ?? '',
        loan_amount: lead.loan_amount ?? '',
        property_address: lead.property_address ?? '',
        credit_score: lead.credit_score ?? '',
        ...sectionData,
      },
      status: app?.status ?? 'draft',
    };
  }

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: 'Activity' },
    { key: 'application', label: '1003' },
    { key: 'income', label: 'Income' },
    { key: 'documents', label: documents && documents.length > 0 ? `Documents (${documents.length})` : 'Documents' },
    { key: 'conditions', label: 'Conditions' },
    { key: 'communications', label: 'Communications' },
    { key: 'notes', label: notes && notes.length > 0 ? `Notes (${notes.length})` : 'Notes' },
    { key: 'compliance', label: hasTridIssue ? 'Compliance ⚠' : 'Compliance', alert: hasTridIssue },
  ] as const;

  return (
    <div className="max-w-[1200px] space-y-5">
      {/* ── Back nav ────────────────────────────────────────────────── */}
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-label-2 hover:text-black transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Leads
      </Link>

      {/* ── Lead header ─────────────────────────────────────────────── */}
      <div className="bg-surface rounded-card shadow-card border border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-[#F5EFE0] border-2 border-[#C9A95C] flex items-center justify-center flex-shrink-0">
              <span className="text-[16px] font-semibold text-[#8A6310]">
                {lead.first_name?.[0]}
                {lead.last_name?.[0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[20px] font-bold text-black tracking-tight">
                  {lead.first_name} {lead.last_name}
                </h1>
                <Badge variant={STAGE_BADGE_VARIANT[lead.stage as LeadStage] ?? 'neutral'}>
                  {STAGE_LABELS[lead.stage] ?? lead.stage}
                </Badge>
                {hasTridIssue && (
                  <span className="inline-flex items-center gap-1 text-xs text-red font-medium">
                    <AlertTriangle size={12} />
                    TRID Alert
                  </span>
                )}
                <DNCStatusBadge phone={lead.phone} />
                <TcpaWindowBadge leadId={lead.id} />
              </div>
              <p className="text-sm text-label-2 mt-1">
                {formatMortgageEnum(lead.loan_type, LOAN_TYPE_LABELS) ?? 'Loan type TBD'} ·{' '}
                {lead.loan_amount ? `$${lead.loan_amount.toLocaleString()}` : 'Amount TBD'} ·{' '}
                {formatMortgageEnum(lead.lead_source, LEAD_SOURCE_LABELS) ?? 'Direct'}
              </p>
              <p className="text-xs text-label-3 mt-0.5">
                Created {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          {/* Header quick actions — lean bar; per-lead tools moved into tabs (TCPA gated) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <AIDraftsPanel leadId={lead.id} />
            <LeadToolsMenu loanId={lead.id} isConstruction={isConstructionLoan} isClosed={lead.stage === 'closed'} />
            <ScenarioAIPanel
              leadId={lead.id}
              initial={{
                loan_type: lead.loan_type ?? undefined,
                loan_amount: lead.loan_amount ?? undefined,
                purpose: lead.loan_purpose ?? undefined,
                dscr_ratio:
                  (lead.loan_file_data as { dscr_calc?: { dscr?: number } } | null)?.dscr_calc?.dscr ?? undefined,
              }}
            />
            {lead.phone && lead.sms_consent ? (
              <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium bg-green/10 text-green border border-green/20 hover:bg-green/15 transition-colors">
                <MessageSquare size={14} />
                SMS
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium bg-fill text-label-3 border border-border cursor-not-allowed"
                title="SMS consent required (TCPA)"
                disabled
              >
                <MessageSquare size={14} />
                SMS
              </button>
            )}
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors"
              >
                <Phone size={14} />
                Call
              </a>
            )}
            {lead.email && !lead.unsubscribed_email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors"
              >
                <Mail size={14} />
                Email
              </a>
            )}
            <Link
              href={`/loans/${lead.id}`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors"
            >
              <FolderOpen size={14} />
              Open File
            </Link>
          </div>
        </div>
      </div>

      {/* ── Borrower going quiet (Phase 85) — self-hides unless ghost score ≥ 5 ── */}
      <BorrowerEngagementBanner leadId={lead.id} borrowerFirstName={lead.first_name ?? 'there'} />

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border flex gap-0 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const isAlert = 'alert' in tab && tab.alert;
          return (
            <Link
              key={tab.key}
              href={`/leads/${lead.id}?tab=${tab.key}`}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                isActive ? 'border-[#C9A95C] text-[#8A6310]' : 'border-transparent text-label-2 hover:text-black'
              } ${isAlert ? 'text-red' : ''}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* ════════════════════ OVERVIEW ════════════════════ */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {isInvestorLoan && (
            <div className="lg:col-span-2">
              <InvestorEntityPanel leadId={lead.id} />
            </div>
          )}

          {/* Contact info */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">Contact Information</h3>
            <div className="space-y-3">
              <InfoRow label="Email" value={lead.email} />
              <InfoRow
                label="Phone"
                value={lead.phone ? (canViewPII ? lead.phone : '(***) ***-' + lead.phone.slice(-4)) : null}
              />
              {lead.ssn_encrypted && (
                <InfoRow label="SSN" value={canViewPII ? '(click to reveal)' : maskSSN('000000000')} />
              )}
              <InfoRow
                label="SMS Consent"
                value={
                  lead.sms_consent ? (
                    <span className="text-green text-sm">
                      ✓ Consent obtained{' '}
                      {lead.sms_consent_obtained_at &&
                        format(new Date(lead.sms_consent_obtained_at), 'MMM d, yyyy')}
                    </span>
                  ) : (
                    <span className="text-red text-sm">Not obtained — SMS blocked</span>
                  )
                }
              />
              <InfoRow
                label="Email Opt-out"
                value={
                  lead.unsubscribed_email ? (
                    <span className="text-orange text-sm">Unsubscribed</span>
                  ) : (
                    <span className="text-green text-sm">Subscribed</span>
                  )
                }
              />
            </div>
          </div>

          {/* Loan details */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">Loan Details</h3>
            <div className="space-y-3">
              <InfoRow label="Loan Purpose" value={formatMortgageEnum(lead.loan_purpose, LOAN_PURPOSE_LABELS)} />
              <InfoRow label="Loan Type" value={formatMortgageEnum(lead.loan_type, LOAN_TYPE_LABELS)} />
              <InfoRow label="Loan Amount" value={lead.loan_amount ? `$${lead.loan_amount.toLocaleString()}` : null} />
              <InfoRow label="LTV" value={displayLtv} />
              <InfoRow label="Property Type" value={formatMortgageEnum(lead.property_type, PROPERTY_TYPE_LABELS)} />
              <InfoRow label="Occupancy" value={formatMortgageEnum(lead.occupancy_type, OCCUPANCY_LABELS)} />
              <InfoRow
                label="Down Payment"
                value={lead.down_payment ? `$${lead.down_payment.toLocaleString()}` : null}
              />
              {lead.closing_date && (
                <InfoRow label="Closing Date" value={format(new Date(lead.closing_date), 'MMM d, yyyy')} />
              )}
            </div>
          </div>

          {/* Credit snapshot — moved off the header into the command center */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">Credit Snapshot</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full border-2 border-[#C9A95C] flex items-center justify-center text-sm font-semibold text-[#8A6310] flex-shrink-0">
                {lead.credit_score ?? '—'}
              </div>
              <div>
                <p className="text-sm font-medium text-black">
                  {lead.credit_score ? `Mid score ${lead.credit_score}` : 'Score not pulled'}
                </p>
                <p className="text-xs text-label-2">SSN/DOB never stored — pulled on demand via vendor</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="text-sm font-medium text-black">Credit monitor</p>
                <p className="text-xs text-label-2">Alert on score change</p>
              </div>
              <CreditMonitoringButton leadId={lead.id} />
            </div>
            <div className="flex items-center justify-between py-2 border-t border-border">
              <div>
                <p className="text-sm font-medium text-black">Credit repair</p>
                <p className="text-xs text-label-2">Enroll in program</p>
              </div>
              <EnrollCreditRepairButton leadId={lead.id} />
            </div>
          </div>

          {/* Quick actions — pre-approval + task delegation (moved off the header) */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium text-black">Pre-approval letter</p>
                  <p className="text-xs text-label-2">Generate and send instantly</p>
                </div>
                <PreApprovalCertButton
                  leadId={lead.id}
                  defaultAmount={lead.loan_amount}
                  defaultLoanType={lead.loan_type}
                />
              </div>
              <div className="flex items-center justify-between gap-3 py-2 border-t border-border">
                <div>
                  <p className="text-sm font-medium text-black">Assign task</p>
                  <p className="text-xs text-label-2">Delegate to a team member</p>
                </div>
                <AssignTaskButton leadId={lead.id} />
              </div>
            </div>
          </div>

          {/* Property address */}
          {(lead.property_address || lead.property_city) && (
            <div className="bg-surface rounded-card shadow-card border border-border p-5">
              <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">Property Address</h3>
              <address className="not-italic text-sm text-black space-y-0.5">
                {lead.property_address && <p>{lead.property_address}</p>}
                <p>{[lead.property_city, lead.property_state, lead.property_zip].filter(Boolean).join(', ')}</p>
              </address>
            </div>
          )}

          {/* AI Score */}
          {lead.ai_score !== null && (
            <div className="bg-surface rounded-card shadow-card border border-border p-5">
              <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">AI Score</h3>
              <div className="flex items-center gap-4">
                <div
                  className={`text-[48px] metric-value ${
                    lead.ai_score >= 70 ? 'text-green' : lead.ai_score >= 40 ? 'text-orange' : 'text-red'
                  }`}
                >
                  {lead.ai_score}
                </div>
                <div>
                  <p className="text-sm font-medium text-black">
                    {lead.ai_score >= 70 ? 'Strong lead' : lead.ai_score >= 40 ? 'Moderate lead' : 'Needs attention'}
                  </p>
                  <p className="text-xs text-label-2">Based on income, credit, LTV, and engagement signals</p>
                </div>
              </div>

              {Array.isArray(lead.ai_score_factors) && lead.ai_score_factors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                  {(lead.ai_score_factors as { label: string; contribution: number }[])
                    .filter((f) => f.contribution !== 0)
                    .sort((a, b) => b.contribution - a.contribution)
                    .map((f) => (
                      <div key={f.label} className="flex items-center justify-between text-xs">
                        <span className="text-label-2">{f.label}</span>
                        <span className={`font-mono ${f.contribution > 0 ? 'text-green' : 'text-red'}`}>
                          {f.contribution > 0 ? '+' : ''}
                          {f.contribution}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Recent activity preview */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide">Recent Activity</h3>
              <Link
                href={`/leads/${lead.id}?tab=activity`}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#8A6310] hover:underline"
              >
                See all
                <ChevronRight size={13} />
              </Link>
            </div>
            {(activities ?? []).length === 0 ? (
              <p className="text-sm text-label-2 text-center py-6">No activity recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {(activities ?? []).slice(0, 3).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#C9A95C22] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ActivityIcon size={12} className="text-[#8A6310]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-black truncate">{activity.description}</p>
                      <p className="text-xs text-label-3 mt-0.5">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ ACTIVITY ════════════════════ */}
      {activeTab === 'activity' && (
        <div className="bg-surface rounded-card shadow-card border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-[15px] font-semibold text-black">Activity Timeline</h3>
          </div>
          <div className="divide-y divide-border">
            {(activities ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-label-2 text-sm">No activity recorded yet.</p>
            ) : (
              (activities ?? []).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-[#C9A95C22] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock size={12} className="text-[#8A6310]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-black">{activity.description}</p>
                    <p className="text-xs text-label-3 mt-0.5">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ 1003 (APPLICATION) ════════════════════ */}
      {activeTab === 'application' && (
        <div>
          <p className="text-sm text-label-2 mb-4">
            Smart 1003 — fields appear only as they become relevant. SSN/DOB are collected separately and never
            stored in plain text.
          </p>
          {appSeed ? (
            <Smart1003Form leadId={lead.id} initialValues={appSeed.values} initialStatus={appSeed.status} />
          ) : (
            <div className="bg-surface rounded-card border border-border p-8 text-center">
              <p className="text-sm text-label-2">Application form unavailable.</p>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ INCOME ════════════════════ */}
      {activeTab === 'income' && (
        <div>
          <IncomeHubClient leadId={lead.id} />
        </div>
      )}

      {/* ════════════════════ DOCUMENTS ════════════════════ */}
      {activeTab === 'documents' && (
        <div className="bg-surface rounded-card shadow-card border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-[15px] font-semibold text-black">Documents</h3>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors">
              <FileText size={13} />
              Upload
            </button>
          </div>
          <div className="divide-y divide-border">
            {(documents ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-label-2 text-sm">No documents uploaded yet.</p>
            ) : (
              (documents ?? []).map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText size={16} className="text-label-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black truncate">{doc.file_name}</p>
                    <p className="text-xs text-label-2">
                      {formatMortgageEnum(doc.document_type, {})} · {(doc.file_size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {doc.verified ? (
                    <Badge variant="success" size="sm">
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="warning" size="sm">
                      Pending
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ CONDITIONS ════════════════════ */}
      {activeTab === 'conditions' && (
        <ConditionsManager loanId={lead.id} initial={conditions} />
      )}

      {/* ════════════════════ COMMUNICATIONS ════════════════════ */}
      {activeTab === 'communications' && (
        <div className="bg-surface rounded-card shadow-card border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-[15px] font-semibold text-black">Communications</h3>
          </div>
          <div className="divide-y divide-border">
            {communications.length === 0 ? (
              <p className="px-5 py-8 text-center text-label-2 text-sm">No communications recorded yet.</p>
            ) : (
              communications.map((msg) => (
                <div key={msg.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {msg.channel === 'sms' && <MessageSquare size={16} className="text-blue" />}
                    {msg.channel === 'email' && <Mail size={16} className="text-[#8A6310]" />}
                    {msg.channel === 'call' && <Phone size={16} className="text-green" />}
                    {(!msg.channel || msg.channel === 'note') && <FileText size={16} className="text-label-2" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-label-2 mb-1">
                      {CHANNEL_LABEL[msg.channel ?? 'note'] ?? msg.channel} ·{' '}
                      {msg.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                    </p>
                    {msg.subject && <p className="text-sm font-medium text-black">{msg.subject}</p>}
                    {msg.body && <p className="text-sm text-black line-clamp-2">{msg.body}</p>}
                    <p className="text-xs text-label-3 mt-0.5">
                      {formatDistanceToNow(new Date(msg.sent_at ?? msg.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ════════════════════ NOTES ════════════════════ */}
      {activeTab === 'notes' && (
        <div className="bg-surface rounded-card shadow-card border border-border divide-y divide-border">
          {(notes ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-label-2 text-sm">No notes yet.</p>
          ) : (
            (notes ?? []).map((note) => {
              const authorRaw = note.profiles as
                | { first_name: string; last_name: string }
                | { first_name: string; last_name: string }[]
                | null;
              const author = Array.isArray(authorRaw) ? authorRaw[0] ?? null : authorRaw;
              return (
                <div key={note.id} className="px-5 py-4">
                  <p className="text-sm text-black whitespace-pre-wrap">{note.content}</p>
                  <p className="text-xs text-label-3 mt-1">
                    {author ? `${author.first_name} ${author.last_name} · ` : ''}
                    {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    {note.is_private ? ' · Private' : ''}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════ COMPLIANCE (was TRID) ════════════════════ */}
      {activeTab === 'compliance' && (
        <div className="bg-surface rounded-card shadow-card border border-border p-5">
          <TRIDTimeline
            tridStatus={trid}
            applicationDate={lead.application_submitted_at}
            leDeadline={lead.le_deadline}
            leSentAt={lead.loan_estimate_sent_at}
            closingDate={lead.closing_date}
            cdDeadline={lead.cd_deadline}
            cdSentAt={lead.closing_disclosure_sent_at}
            canEdit={role === 'admin' || role === 'branch_manager' || role === 'loan_officer'}
          />
          <div className="mt-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-label-2 mb-2">
              Closing &amp; operations
            </p>
            <LoanOpsPanel
              leadId={lead.id}
              channel={(orgRow as { channel?: string } | null)?.channel ?? null}
              initial={{
                emd_amount: (lead as { emd_amount?: number }).emd_amount ?? null,
                emd_due_date: (lead as { emd_due_date?: string }).emd_due_date ?? null,
                emd_received_date: (lead as { emd_received_date?: string }).emd_received_date ?? null,
                mers_min: (lead as { mers_min?: string }).mers_min ?? null,
                mers_status: (lead as { mers_status?: string }).mers_status ?? null,
                first_payment_date: (lead as { first_payment_date?: string }).first_payment_date ?? null,
                monthly_payment_amount: (lead as { monthly_payment_amount?: number }).monthly_payment_amount ?? null,
                loan_servicer_name: (lead as { loan_servicer_name?: string }).loan_servicer_name ?? null,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined | React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-label-2 flex-shrink-0">{label}</span>
      <span className="text-black text-right">{value ?? <span className="text-label-3">—</span>}</span>
    </div>
  );
}
