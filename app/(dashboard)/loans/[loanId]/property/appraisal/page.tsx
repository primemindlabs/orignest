import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type AppraisalOrder = {
  id: string;
  amc_order_id: string | null;
  amc_vendor: string | null;
  property_address: string | null;
  appraisal_type: string | null;
  rush_order: boolean | null;
  fee_amount: number | null;
  fee_paid_by: string | null;
  status: string | null;
  appraiser_name: string | null;
  appraiser_license: string | null;
  appraiser_company: string | null;
  inspection_scheduled_at: string | null;
  inspection_completed_at: string | null;
  report_delivered_at: string | null;
  appraised_value: number | null;
  amc_status_history: unknown;
  ordered_at: string | null;
  updated_at: string | null;
};

const STATUS_FLOW = [
  'pending',
  'ordered',
  'assigned',
  'inspection_scheduled',
  'inspection_complete',
  'report_in_review',
  'report_delivered',
  'completed',
] as const;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  ordered: 'Ordered',
  assigned: 'Appraiser Assigned',
  inspection_scheduled: 'Inspection Scheduled',
  inspection_complete: 'Inspection Complete',
  report_in_review: 'Report In Review',
  report_delivered: 'Report Delivered',
  revision_requested: 'Revision Requested',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function fmtDate(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(v: number | null): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function statusBadge(status: string | null) {
  const s = status ?? 'pending';
  let cls = 'text-[var(--c-label2)] border-[var(--c-border)]';
  if (s === 'completed' || s === 'report_delivered') cls = 'text-emerald-700 border-emerald-200 bg-emerald-50';
  else if (s === 'cancelled') cls = 'text-rose-700 border-rose-200 bg-rose-50';
  else if (s === 'revision_requested') cls = 'text-amber-700 border-amber-200 bg-amber-50';
  else cls = 'text-[var(--c-gold-deep)] border-[var(--c-border)] bg-[var(--c-fill)]';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${cls}`}>
      {STATUS_LABEL[s] ?? s}
    </span>
  );
}

function StatusTimeline({ status }: { status: string | null }) {
  const s = status ?? 'pending';
  if (s === 'cancelled') {
    return <p className="text-[13px] text-rose-700">This order was cancelled.</p>;
  }
  const currentIdx = STATUS_FLOW.indexOf(s as (typeof STATUS_FLOW)[number]);
  return (
    <ol className="space-y-2.5">
      {STATUS_FLOW.map((step, i) => {
        const done = currentIdx >= 0 && i < currentIdx;
        const active = currentIdx >= 0 && i === currentIdx;
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                done
                  ? 'bg-emerald-500 text-white'
                  : active
                    ? 'bg-[var(--c-gold-deep)] text-white'
                    : 'border border-[var(--c-border)] text-[var(--c-label3)]'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={`text-[13px] ${
                active ? 'font-semibold text-[var(--c-text)]' : done ? 'text-[var(--c-label2)]' : 'text-[var(--c-label3)]'
              }`}
            >
              {STATUS_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">{label}</dt>
      <dd className="mt-0.5 text-[14px] text-[var(--c-text)]">{value}</dd>
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
    .select('*')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // Defensive: appraisal_orders may not exist in every environment.
  let orders: AppraisalOrder[] = [];
  let hasAmcConnection = false;
  try {
    const { data } = await sb
      .from('appraisal_orders')
      .select('*')
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('ordered_at', { ascending: false });
    orders = (data as AppraisalOrder[] | null) ?? [];
  } catch {
    orders = [];
  }
  try {
    const { count } = await sb
      .from('amc_connections')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_active', true);
    hasAmcConnection = (count ?? 0) > 0;
  } catch {
    hasAmcConnection = false;
  }

  const header = (
    <div>
      <h1 className="text-[20px] font-bold tracking-tight text-[var(--c-text)]">Appraisal</h1>
      <p className="mt-0.5 text-[13px] text-[var(--c-label2)]">
        Appraisal order status, appraiser assignment, and reported value for this loan.
      </p>
    </div>
  );

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl space-y-4">
        {header}
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center">
          <p className="text-[15px] font-semibold text-[var(--c-text)]">No appraisal ordered yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-[var(--c-label2)]">
            {hasAmcConnection
              ? 'An AMC integration is connected. Order an appraisal from your AMC and it will appear here once the order is created.'
              : 'Appraisal ordering runs through your AMC (Appraisal Management Company) integration. Connect one to order appraisals and track status automatically.'}
          </p>
          <div className="mt-4">
            <Link
              href="/settings/integrations"
              className="inline-flex items-center rounded-lg bg-[var(--c-gold-deep)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              {hasAmcConnection ? 'Manage AMC integration' : 'Connect AMC integration'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      {header}
      {orders.map((o) => (
        <div key={o.id} className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {statusBadge(o.status)}
              {o.rush_order ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[12px] font-medium text-amber-700">
                  Rush
                </span>
              ) : null}
            </div>
            <span className="text-[12px] text-[var(--c-label3)]">
              {o.amc_vendor ? `${o.amc_vendor} · ` : ''}
              Ordered {fmtDate(o.ordered_at)}
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Property" value={o.property_address || lead.property_address || '—'} />
            <Field
              label="Type"
              value={(o.appraisal_type || 'full_1004').replace(/_/g, ' ')}
            />
            <Field
              label="Appraised Value"
              value={
                o.appraised_value != null ? (
                  <span className="font-semibold text-emerald-700">{fmtMoney(o.appraised_value)}</span>
                ) : (
                  '—'
                )
              }
            />
            <Field label="Appraiser" value={o.appraiser_name || '—'} />
            <Field label="Appraiser Company" value={o.appraiser_company || '—'} />
            <Field label="License #" value={o.appraiser_license || '—'} />
            <Field label="Fee" value={fmtMoney(o.fee_amount)} />
            <Field label="Paid By" value={o.fee_paid_by ? o.fee_paid_by[0].toUpperCase() + o.fee_paid_by.slice(1) : '—'} />
            <Field label="AMC Order ID" value={o.amc_order_id || '—'} />
            <Field label="Inspection Scheduled" value={fmtDate(o.inspection_scheduled_at)} />
            <Field label="Inspection Complete" value={fmtDate(o.inspection_completed_at)} />
            <Field label="Report Delivered" value={fmtDate(o.report_delivered_at)} />
          </dl>

          <div className="mt-5 border-t border-[var(--c-border)] pt-4">
            <p className="mb-3 text-[11px] uppercase tracking-wide text-[var(--c-label3)]">Order Progress</p>
            <StatusTimeline status={o.status} />
          </div>
        </div>
      ))}

      <p className="text-[12px] text-[var(--c-label3)]">
        Status updates sync from your AMC.{' '}
        <Link href="/settings/integrations" className="underline hover:text-[var(--c-label2)]">
          Manage integration
        </Link>
      </p>
    </div>
  );
}
