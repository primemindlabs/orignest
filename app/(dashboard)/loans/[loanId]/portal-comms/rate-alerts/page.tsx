import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type StatusTone = { label: string; tone: string };

function monitoringTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case 'active':
      return { label: 'Active', tone: 'var(--c-success)' };
    case 'paused':
      return { label: 'Paused', tone: 'var(--c-warning)' };
    case 'opted_out':
      return { label: 'Opted out', tone: 'var(--c-danger)' };
    default:
      return { label: 'Not monitored', tone: 'var(--c-label3)' };
  }
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtPct(n: number | null | undefined): string {
  return n != null ? `${Number(n).toFixed(3)}%` : '—';
}

function fmtMoney(n: number | null | undefined): string {
  return n != null ? `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, email')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  const borrowerName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim() || 'this borrower';
  const email = (lead.email ?? '').trim().toLowerCase();

  // ── Post-close rate/equity relationship (Phase 28/103), keyed by org_id + email ──
  type Relationship = {
    id: string;
    monitoring_status: string | null;
    original_rate: number | null;
    current_market_rate: number | null;
    rate_delta: number | null;
    monthly_savings_if_refi: number | null;
    estimated_equity: number | null;
    last_close_date: string | null;
    refi_alert_sent: boolean | null;
  };
  let relationship: Relationship | null = null;
  if (email) {
    const { data } = await sb
      .from('borrower_relationships')
      .select(
        'id, monitoring_status, original_rate, current_market_rate, rate_delta, monthly_savings_if_refi, estimated_equity, last_close_date, refi_alert_sent',
      )
      .eq('org_id', orgId)
      .eq('email', email)
      .maybeSingle();
    relationship = (data as Relationship | null) ?? null;
  }

  // ── Rate alerts fired for this relationship ──
  type RateAlert = {
    id: string;
    trigger_type: string;
    original_rate: number | null;
    current_rate: number | null;
    monthly_savings: number | null;
    sent_via: string;
    sent_at: string | null;
  };
  let rateAlerts: RateAlert[] = [];
  if (relationship?.id) {
    const { data } = await sb
      .from('relationship_rate_alerts')
      .select('id, trigger_type, original_rate, current_rate, monthly_savings, sent_via, sent_at')
      .eq('org_id', orgId)
      .eq('relationship_id', relationship.id)
      .order('sent_at', { ascending: false })
      .limit(10);
    rateAlerts = (data as RateAlert[] | null) ?? [];
  }

  // ── Credit monitoring enrollment + alerts for this loan (Phase 47), keyed by lead_id ──
  type Enrollment = { id: string; vendor: string; monitoring_type: string; is_active: boolean | null; enrolled_at: string | null };
  const { data: enrollData } = await sb
    .from('credit_monitoring_enrollments')
    .select('id, vendor, monitoring_type, is_active, enrolled_at')
    .eq('org_id', orgId)
    .eq('lead_id', params.loanId)
    .order('enrolled_at', { ascending: false });
  const enrollments = (enrollData as Enrollment[] | null) ?? [];
  const activeEnrollment = enrollments.find((e) => e.is_active) ?? null;

  type CreditAlert = {
    id: string;
    alert_type: string;
    previous_score: number | null;
    new_score: number | null;
    score_delta: number | null;
    inquiring_lender: string | null;
    actioned_at: string | null;
    received_at: string | null;
  };
  const { data: caData } = await sb
    .from('credit_alerts')
    .select('id, alert_type, previous_score, new_score, score_delta, inquiring_lender, actioned_at, received_at')
    .eq('org_id', orgId)
    .eq('lead_id', params.loanId)
    .order('received_at', { ascending: false })
    .limit(10);
  const creditAlerts = (caData as CreditAlert[] | null) ?? [];
  const openCreditAlerts = creditAlerts.filter((a) => !a.actioned_at).length;

  const rateStatus = monitoringTone(relationship?.monitoring_status);
  const creditStatus: StatusTone = activeEnrollment
    ? { label: 'Active', tone: 'var(--c-success)' }
    : enrollments.length > 0
      ? { label: 'Inactive', tone: 'var(--c-warning)' }
      : { label: 'Not enrolled', tone: 'var(--c-label3)' };

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Rate Alerts &amp; Monitoring</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Rate, equity, and credit watch for {borrowerName}.
        </p>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Rate / equity monitoring */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Rate &amp; Equity Watch</p>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: rateStatus.tone, background: 'var(--c-fill)' }}
            >
              {rateStatus.label}
            </span>
          </div>
          {relationship ? (
            <dl className="mt-3 grid grid-cols-2 gap-y-2 gap-x-3 text-[13px]">
              <dt className="text-[var(--c-label2)]">Original rate</dt>
              <dd className="text-right tabular-nums text-[var(--c-text)]">{fmtPct(relationship.original_rate)}</dd>
              <dt className="text-[var(--c-label2)]">Market rate</dt>
              <dd className="text-right tabular-nums text-[var(--c-text)]">{fmtPct(relationship.current_market_rate)}</dd>
              <dt className="text-[var(--c-label2)]">Rate delta</dt>
              <dd
                className="text-right tabular-nums font-semibold"
                style={{ color: (relationship.rate_delta ?? 0) >= 0.25 ? 'var(--c-success)' : 'var(--c-text)' }}
              >
                {fmtPct(relationship.rate_delta)}
              </dd>
              <dt className="text-[var(--c-label2)]">Est. monthly savings</dt>
              <dd className="text-right tabular-nums text-[var(--c-text)]">{fmtMoney(relationship.monthly_savings_if_refi)}</dd>
              <dt className="text-[var(--c-label2)]">Est. equity</dt>
              <dd className="text-right tabular-nums text-[var(--c-text)]">{fmtMoney(relationship.estimated_equity)}</dd>
            </dl>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--c-label2)] leading-relaxed">
              No post-close relationship is tracked for this borrower yet. Closed loans are picked up by the equity loop,
              which then watches for rate drops and equity milestones.
            </p>
          )}
          <Link
            href="/equity-loop"
            className="mt-3 inline-block text-[13px] font-semibold text-[var(--c-gold-deep)] hover:underline"
          >
            Open Equity Loop →
          </Link>
        </div>

        {/* Credit monitoring */}
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Credit Monitoring</p>
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: creditStatus.tone, background: 'var(--c-fill)' }}
            >
              {creditStatus.label}
            </span>
          </div>
          {activeEnrollment ? (
            <dl className="mt-3 grid grid-cols-2 gap-y-2 gap-x-3 text-[13px]">
              <dt className="text-[var(--c-label2)]">Vendor</dt>
              <dd className="text-right text-[var(--c-text)] capitalize">{activeEnrollment.vendor.replace(/_/g, ' ')}</dd>
              <dt className="text-[var(--c-label2)]">Type</dt>
              <dd className="text-right text-[var(--c-text)] capitalize">{activeEnrollment.monitoring_type.replace(/_/g, ' ')}</dd>
              <dt className="text-[var(--c-label2)]">Enrolled</dt>
              <dd className="text-right text-[var(--c-text)]">{fmtDate(activeEnrollment.enrolled_at)}</dd>
              <dt className="text-[var(--c-label2)]">Open alerts</dt>
              <dd
                className="text-right tabular-nums font-semibold"
                style={{ color: openCreditAlerts > 0 ? 'var(--c-danger)' : 'var(--c-text)' }}
              >
                {openCreditAlerts}
              </dd>
            </dl>
          ) : (
            <p className="mt-3 text-[13px] text-[var(--c-label2)] leading-relaxed">
              This borrower is not enrolled in credit monitoring. Enroll to catch competitor pull-throughs (inquiry
              alerts) and score changes while the loan is in process.
            </p>
          )}
          <Link
            href="/credit-alerts"
            className="mt-3 inline-block text-[13px] font-semibold text-[var(--c-gold-deep)] hover:underline"
          >
            Open Credit Alerts →
          </Link>
        </div>
      </div>

      {/* Credit alerts feed */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--c-border)]">
          <h2 className="text-[14px] font-semibold text-[var(--c-text)]">Credit Alerts</h2>
        </div>
        {creditAlerts.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-[var(--c-label2)]">No credit alerts on file for this loan.</p>
        ) : (
          <div className="divide-y divide-[var(--c-border)]">
            {creditAlerts.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--c-text)] capitalize">
                    {a.alert_type.replace(/_/g, ' ')}
                    {a.inquiring_lender ? <span className="text-[var(--c-label2)] font-normal"> · {a.inquiring_lender}</span> : null}
                  </p>
                  <p className="text-[11px] text-[var(--c-label3)] mt-0.5">{fmtDate(a.received_at)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {a.score_delta != null && (
                    <span
                      className="text-[13px] tabular-nums font-semibold"
                      style={{ color: a.score_delta >= 0 ? 'var(--c-success)' : 'var(--c-danger)' }}
                    >
                      {a.score_delta >= 0 ? '+' : ''}
                      {a.score_delta}
                    </span>
                  )}
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      color: a.actioned_at ? 'var(--c-label3)' : 'var(--c-danger)',
                      background: 'var(--c-fill)',
                    }}
                  >
                    {a.actioned_at ? 'Actioned' : 'Open'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rate alerts feed */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--c-border)]">
          <h2 className="text-[14px] font-semibold text-[var(--c-text)]">Rate &amp; Equity Alerts</h2>
        </div>
        {rateAlerts.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-[var(--c-label2)]">
            No rate or equity alerts have fired for this borrower yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--c-border)]">
            {rateAlerts.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--c-text)] capitalize">{a.trigger_type.replace(/_/g, ' ')}</p>
                  <p className="text-[11px] text-[var(--c-label3)] mt-0.5">
                    {fmtDate(a.sent_at)} · via {a.sent_via}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {a.monthly_savings != null && (
                    <p className="text-[13px] tabular-nums font-semibold text-[var(--c-success)]">
                      {fmtMoney(a.monthly_savings)}/mo
                    </p>
                  )}
                  {(a.original_rate != null || a.current_rate != null) && (
                    <p className="text-[11px] text-[var(--c-label3)] tabular-nums">
                      {fmtPct(a.original_rate)} → {fmtPct(a.current_rate)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[12px] text-[var(--c-label3)]">
        Monitoring runs org-wide. Use Equity Loop to manage rate/equity outreach and Credit Alerts to action competitor
        inquiries — both filtered to this borrower above.
      </p>
    </div>
  );
}
