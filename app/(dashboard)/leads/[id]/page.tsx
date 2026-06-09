import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import { Phone, Mail, MessageSquare, FileText, Clock, ArrowLeft, AlertTriangle, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { EnrollCreditRepairButton } from './EnrollCreditRepairButton';
import { AIDraftsPanel } from '@/components/loanFile/AIDraftsPanel';
import { ScenarioAIPanel } from '@/components/scenarioAI/ScenarioAIPanel';
import { AssignTaskButton } from '@/components/loanFile/AssignTaskButton';
import { CreditMonitoringButton } from '@/components/leads/CreditMonitoringButton';
import { PreApprovalCertButton } from '@/components/loan/PreApprovalCertButton';
import { LoanOpsPanel } from '@/components/loan/LoanOpsPanel';
import { InvestorEntityPanel } from '@/components/loan/InvestorEntityPanel';
import { TRIDTimeline } from '@/components/compliance/TRIDTimeline';
import { getTRIDStatus } from '@/lib/compliance/trid';
import { maskSSN, maskIncome } from '@/lib/compliance/encryption';
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
        .select('*, profiles(first_name, last_name)')
        .eq('lead_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

  if (!lead) notFound();

  const role = profile?.role ?? 'loan_officer';
  const canViewPII = role === 'admin' || role === 'branch_manager';
  const activeTab = searchParams.tab ?? 'overview';

  const trid = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);
  const { data: orgRow } = await sb.from('organizations').select('channel').eq('id', orgId).maybeSingle();
  const isInvestorLoan = ['dscr', 'commercial', 'bridge', 'construction'].some((t) => (lead.loan_type ?? '').toLowerCase().includes(t));
  const hasTridIssue =
    trid.le === 'overdue' || trid.le === 'due_today' || trid.cd === 'overdue' || trid.cd === 'blocked';

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'documents', label: `Documents${documents && documents.length > 0 ? ` (${documents.length})` : ''}` },
    {
      key: 'trid',
      label: `TRID${hasTridIssue ? ' ⚠' : ''}`,
      alert: hasTridIssue,
    },
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
            <div className="w-12 h-12 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[16px] font-semibold text-blue">
                {lead.first_name?.[0]}{lead.last_name?.[0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-[20px] font-bold text-black tracking-tight">
                  {lead.first_name} {lead.last_name}
                </h1>
                <Badge
                  variant={STAGE_BADGE_VARIANT[lead.stage as LeadStage] ?? 'neutral'}
                >
                  {STAGE_LABELS[lead.stage] ?? lead.stage}
                </Badge>
                {hasTridIssue && (
                  <span className="inline-flex items-center gap-1 text-xs text-red font-medium">
                    <AlertTriangle size={12} />
                    TRID Alert
                  </span>
                )}
              </div>
              <p className="text-sm text-label-2 mt-1">
                {lead.loan_type?.toUpperCase() ?? 'Loan type TBD'} ·{' '}
                {lead.loan_amount ? `$${lead.loan_amount.toLocaleString()}` : 'Amount TBD'} ·{' '}
                {lead.lead_source ?? 'Direct'}
              </p>
              <p className="text-xs text-label-3 mt-0.5">
                Created {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          {/* Quick action buttons — TCPA gated */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <AIDraftsPanel leadId={lead.id} />
            <AssignTaskButton leadId={lead.id} />
            <CreditMonitoringButton leadId={lead.id} />
            <PreApprovalCertButton leadId={lead.id} defaultAmount={lead.loan_amount} defaultLoanType={lead.loan_type} />
            <Link href={`/loans/${lead.id}/income`} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-fill)] transition-colors">
              <FileText size={14} className="text-[var(--c-gold-deep)]" /> Income
            </Link>
            <ScenarioAIPanel
              leadId={lead.id}
              initial={{
                loan_type: lead.loan_type ?? undefined,
                loan_amount: lead.loan_amount ?? undefined,
                purpose: lead.loan_purpose ?? undefined,
                dscr_ratio: (lead.loan_file_data as { dscr_calc?: { dscr?: number } } | null)?.dscr_calc?.dscr ?? undefined,
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
            <Link
              href={`/leads/${lead.id}/application`}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-sm font-medium bg-fill hover:bg-border text-black border border-border transition-colors"
            >
              <FileText size={14} />
              1003
            </Link>
            <EnrollCreditRepairButton leadId={lead.id} />
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border flex gap-0">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/leads/${lead.id}?tab=${tab.key}`}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'border-blue text-blue'
                : 'border-transparent text-label-2 hover:text-black'
            } ${tab.alert ? 'text-red' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {isInvestorLoan && (
            <div className="lg:col-span-2">
              <InvestorEntityPanel leadId={lead.id} />
            </div>
          )}
          {/* Contact info */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">
              Contact Information
            </h3>
            <div className="space-y-3">
              <InfoRow label="Email" value={lead.email} />
              <InfoRow
                label="Phone"
                value={
                  lead.phone
                    ? canViewPII
                      ? lead.phone
                      : '(***) ***-' + lead.phone.slice(-4)
                    : null
                }
              />
              {lead.ssn_encrypted && (
                <InfoRow
                  label="SSN"
                  value={canViewPII ? '(click to reveal)' : maskSSN('000000000')}
                />
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
                value={lead.unsubscribed_email ? (
                  <span className="text-orange text-sm">Unsubscribed</span>
                ) : (
                  <span className="text-green text-sm">Subscribed</span>
                )}
              />
            </div>
          </div>

          {/* Loan details */}
          <div className="bg-surface rounded-card shadow-card border border-border p-5">
            <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">
              Loan Details
            </h3>
            <div className="space-y-3">
              <InfoRow label="Loan Type" value={lead.loan_type?.toUpperCase()} />
              <InfoRow label="Loan Purpose" value={lead.loan_purpose?.replace('_', ' ')} />
              <InfoRow
                label="Loan Amount"
                value={lead.loan_amount ? `$${lead.loan_amount.toLocaleString()}` : null}
              />
              <InfoRow
                label="Down Payment"
                value={lead.down_payment ? `$${lead.down_payment.toLocaleString()}` : null}
              />
              <InfoRow
                label="LTV"
                value={lead.ltv ? `${lead.ltv.toFixed(1)}%` : null}
              />
              <InfoRow label="Property Type" value={lead.property_type?.replace('_', ' ')} />
              <InfoRow label="Occupancy" value={lead.occupancy_type?.replace('_', ' ')} />
              {lead.closing_date && (
                <InfoRow
                  label="Closing Date"
                  value={format(new Date(lead.closing_date), 'MMM d, yyyy')}
                />
              )}
            </div>
          </div>

          {/* Property address */}
          {(lead.property_address || lead.property_city) && (
            <div className="bg-surface rounded-card shadow-card border border-border p-5">
              <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">
                Property Address
              </h3>
              <address className="not-italic text-sm text-black space-y-0.5">
                {lead.property_address && <p>{lead.property_address}</p>}
                <p>
                  {[lead.property_city, lead.property_state, lead.property_zip]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </address>
            </div>
          )}

          {/* AI Score */}
          {lead.ai_score !== null && (
            <div className="bg-surface rounded-card shadow-card border border-border p-5">
              <h3 className="text-sm font-semibold text-label-2 uppercase tracking-wide mb-4">
                AI Score
              </h3>
              <div className="flex items-center gap-4">
                <div
                  className={`text-[48px] metric-value ${
                    lead.ai_score >= 70
                      ? 'text-green'
                      : lead.ai_score >= 40
                      ? 'text-orange'
                      : 'text-red'
                  }`}
                >
                  {lead.ai_score}
                </div>
                <div>
                  <p className="text-sm font-medium text-black">
                    {lead.ai_score >= 70
                      ? 'Strong lead'
                      : lead.ai_score >= 40
                      ? 'Moderate lead'
                      : 'Needs attention'}
                  </p>
                  <p className="text-xs text-label-2">
                    Based on income, credit, LTV, and engagement signals
                  </p>
                </div>
              </div>

              {/* Score factors (Phase 1.2) */}
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
        </div>
      )}

      {activeTab === 'timeline' && (
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
                  <div className="w-7 h-7 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock size={12} className="text-blue" />
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
              <p className="px-5 py-8 text-center text-label-2 text-sm">
                No documents uploaded yet.
              </p>
            ) : (
              (documents ?? []).map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText size={16} className="text-label-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-black truncate">{doc.file_name}</p>
                    <p className="text-xs text-label-2">
                      {doc.document_type?.replace('_', ' ')} ·{' '}
                      {(doc.file_size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  {doc.verified ? (
                    <Badge variant="success" size="sm">Verified</Badge>
                  ) : (
                    <Badge variant="warning" size="sm">Pending</Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'trid' && (
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
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label2)] mb-2">Closing &amp; operations</p>
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
      <span className="text-black text-right">
        {value ?? <span className="text-label-3">—</span>}
      </span>
    </div>
  );
}