import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import {
  getTRIDStatus,
  getLoanEstimateDeadline,
  getClosingDisclosureDeadline,
  tridBusinessDaysRemaining,
  getTRIDColorState,
  type TRIDColorState,
} from '@/lib/compliance/trid';
import type { TRIDStatusValue } from '@/types';

export const dynamic = 'force-dynamic';

type TridEvent = {
  id: string;
  event_type: string;
  event_date: string;
  deadline_date: string | null;
  business_days_to_deadline: number | null;
  is_compliant: boolean | null;
  notes: string | null;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  le_issued: 'Loan Estimate Issued',
  le_received: 'Loan Estimate Received',
  le_revised: 'Loan Estimate Revised',
  cd_issued: 'Closing Disclosure Issued',
  cd_received: 'Closing Disclosure Received',
  cd_revised: 'Closing Disclosure Revised',
  rate_lock_set: 'Rate Lock Set',
  rate_lock_extended: 'Rate Lock Extended',
  closing_date_set: 'Closing Date Set',
};

function fmtDate(d: string | Date | null): string {
  if (!d) return '—';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_META: Record<TRIDStatusValue, { label: string; cls: string }> = {
  ok: { label: 'On Track', cls: 'bg-emerald-500/12 text-emerald-600 border-emerald-500/30' },
  due_today: { label: 'Due Today', cls: 'bg-amber-500/12 text-amber-600 border-amber-500/30' },
  overdue: { label: 'Overdue', cls: 'bg-red-500/12 text-red-600 border-red-500/30' },
  blocked: { label: 'Blocked', cls: 'bg-red-500/12 text-red-600 border-red-500/30' },
  not_applicable: { label: 'N/A', cls: 'bg-[var(--c-fill)] text-[var(--c-label3)] border-[var(--c-border)]' },
};

const COLOR_DOT: Record<TRIDColorState, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  critical: 'bg-red-600',
};

function StatusBadge({ status }: { status: TRIDStatusValue }) {
  const m = STATUS_META[status] ?? STATUS_META.not_applicable;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

function DisclosureCard({
  title,
  status,
  deadline,
  sentAt,
  daysRemaining,
  ruleNote,
}: {
  title: string;
  status: TRIDStatusValue;
  deadline: Date | null;
  sentAt: string | null;
  daysRemaining: number | null;
  ruleNote: string;
}) {
  const bizDays = deadline && !sentAt ? tridBusinessDaysRemaining(deadline) : null;
  const colorState = bizDays !== null ? getTRIDColorState(bizDays) : null;

  return (
    <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {colorState && <span className={`h-2 w-2 rounded-full ${COLOR_DOT[colorState]}`} />}
          <h3 className="text-[14px] font-semibold text-[var(--c-text)]">{title}</h3>
        </div>
        <StatusBadge status={status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-y-2 text-[12px]">
        <dt className="text-[var(--c-label3)]">Deadline</dt>
        <dd className="text-right font-medium text-[var(--c-text)]">{fmtDate(deadline)}</dd>
        <dt className="text-[var(--c-label3)]">{sentAt ? 'Delivered' : 'Status'}</dt>
        <dd className="text-right font-medium text-[var(--c-text)]">
          {sentAt
            ? fmtDate(sentAt)
            : bizDays !== null
              ? bizDays < 0
                ? `${Math.abs(bizDays)} biz day${Math.abs(bizDays) !== 1 ? 's' : ''} overdue`
                : `${bizDays} biz day${bizDays !== 1 ? 's' : ''} left`
              : daysRemaining !== null
                ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
                : 'Not yet sent'}
        </dd>
      </dl>
      <p className="mt-3 text-[11px] leading-snug text-[var(--c-label3)] border-t border-[var(--c-border)] pt-2">
        {ruleNote}
      </p>
    </div>
  );
}

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select(
      'id, stage, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date',
    )
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // Live TRID status derived from the loan record.
  const trid = getTRIDStatus({
    stage: lead.stage ?? 'new_inquiry',
    application_submitted_at: lead.application_submitted_at ?? null,
    loan_estimate_sent_at: lead.loan_estimate_sent_at ?? null,
    closing_disclosure_sent_at: lead.closing_disclosure_sent_at ?? null,
    closing_date: lead.closing_date ?? null,
  });

  const leDeadline = lead.application_submitted_at
    ? getLoanEstimateDeadline(new Date(lead.application_submitted_at))
    : trid.le_deadline;
  const cdDeadline = lead.closing_date
    ? getClosingDisclosureDeadline(new Date(lead.closing_date))
    : trid.cd_deadline;

  // Immutable disclosure event log (defensive: table may be empty / absent).
  let events: TridEvent[] = [];
  try {
    const { data } = await sb
      .from('trid_events')
      .select('id, event_type, event_date, deadline_date, business_days_to_deadline, is_compliant, notes, created_at')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false });
    events = (data ?? []) as TridEvent[];
  } catch {
    events = [];
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Loan Estimates</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          TRID disclosure timing for this loan — LE within 3 business days of application, CD at least
          3 business days before consummation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DisclosureCard
          title="Loan Estimate (LE)"
          status={trid.le}
          deadline={leDeadline}
          sentAt={lead.loan_estimate_sent_at ?? null}
          daysRemaining={trid.le_days_remaining}
          ruleNote="Must be delivered within 3 business days of receiving the application (12 CFR 1026.19(e)(1)(iii))."
        />
        <DisclosureCard
          title="Closing Disclosure (CD)"
          status={trid.cd}
          deadline={cdDeadline}
          sentAt={lead.closing_disclosure_sent_at ?? null}
          daysRemaining={trid.cd_days_remaining}
          ruleNote="Borrower must receive it at least 3 business days before consummation (12 CFR 1026.19(f)(1)(ii))."
        />
      </div>

      <div>
        <h2 className="text-[14px] font-semibold text-[var(--c-text)] mb-2">Disclosure Timeline</h2>
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center">
            <p className="text-[13px] font-medium text-[var(--c-text)]">No disclosure events logged yet</p>
            <p className="text-[12px] text-[var(--c-label3)] mt-1 max-w-sm mx-auto">
              TRID events (LE/CD issued, received, or revised) are recorded automatically as the loan
              progresses. The compliance status above is computed live from this loan&apos;s application and
              closing dates.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-surface)] overflow-hidden">
            <ol className="divide-y divide-[var(--c-border)]">
              {events.map((ev) => {
                const compliant = ev.is_compliant;
                return (
                  <li key={ev.id} className="flex items-start gap-3 px-4 py-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        compliant === false
                          ? 'bg-red-500'
                          : compliant === true
                            ? 'bg-emerald-500'
                            : 'bg-[var(--c-label3)]'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium text-[var(--c-text)]">
                          {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                        </span>
                        <span className="text-[12px] text-[var(--c-label3)] shrink-0">
                          {fmtDate(ev.event_date)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--c-label3)]">
                        {ev.deadline_date && <span>Deadline {fmtDate(ev.deadline_date)}</span>}
                        {ev.business_days_to_deadline != null && (
                          <span>{ev.business_days_to_deadline} biz days to deadline</span>
                        )}
                        {compliant === false && (
                          <span className="font-semibold text-red-600">Out of tolerance</span>
                        )}
                        {compliant === true && (
                          <span className="font-semibold text-emerald-600">Compliant</span>
                        )}
                      </div>
                      {ev.notes && (
                        <p className="mt-1 text-[12px] text-[var(--c-label2)]">{ev.notes}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
