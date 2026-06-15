import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type RateLockRequest = {
  id: string;
  request_type: string | null;
  requested_rate: number | null;
  requested_lock_days: number | null;
  requested_price: number | null;
  requested_lock_expiration: string | null;
  original_lock_expiration: string | null;
  extension_days: number | null;
  extension_cost_bps: number | null;
  status: string | null;
  review_notes: string | null;
  notes: string | null;
  created_at: string | null;
};

type ExtensionLog = {
  id: string;
  lock_expiry_date: string | null;
  extension_days_requested: number | null;
  bps_per_day: number | null;
  total_cost_est: number | null;
  outcome: string | null;
  outcome_notes: string | null;
  logged_at: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  new_lock: 'New Lock',
  extension: 'Extension',
  renegotiation: 'Renegotiation',
  float_to_lock: 'Float to Lock',
  lock_cancellation: 'Cancellation',
};

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return null;
  const ms = parsed.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? 'pending').toLowerCase();
  const styles: Record<string, { bg: string; fg: string }> = {
    approved: { bg: 'rgba(34,197,94,0.12)', fg: '#16a34a' },
    pending: { bg: 'rgba(234,179,8,0.14)', fg: '#a16207' },
    declined: { bg: 'rgba(239,68,68,0.12)', fg: '#dc2626' },
    denied: { bg: 'rgba(239,68,68,0.12)', fg: '#dc2626' },
    cancelled: { bg: 'var(--c-fill)', fg: 'var(--c-label2)' },
  };
  const st = styles[s] ?? { bg: 'var(--c-fill)', fg: 'var(--c-label2)' };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
      style={{ backgroundColor: st.bg, color: st.fg }}
    >
      {s}
    </span>
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

  const [reqRes, logRes] = await Promise.all([
    sb
      .from('rate_lock_requests')
      .select(
        'id,request_type,requested_rate,requested_lock_days,requested_price,requested_lock_expiration,original_lock_expiration,extension_days,extension_cost_bps,status,review_notes,notes,created_at',
      )
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    sb
      .from('rate_lock_extension_log')
      .select(
        'id,lock_expiry_date,extension_days_requested,bps_per_day,total_cost_est,outcome,outcome_notes,logged_at',
      )
      .eq('lead_id', params.loanId)
      .eq('org_id', orgId)
      .order('logged_at', { ascending: false }),
  ]);

  const requests = (reqRes.data ?? []) as RateLockRequest[];
  const extLogs = (logRes.data ?? []) as ExtensionLog[];

  // Derive current active lock = most recent approved request that established/extended a lock.
  const activeLock = requests.find(
    (r) =>
      (r.status ?? '').toLowerCase() === 'approved' &&
      (r.requested_lock_expiration || r.original_lock_expiration),
  );
  const lockExpiry =
    activeLock?.requested_lock_expiration ?? activeLock?.original_lock_expiration ?? null;
  const expiryDays = daysUntil(lockExpiry);
  const expiringSoon = expiryDays != null && expiryDays <= 5 && expiryDays >= 0;
  const expired = expiryDays != null && expiryDays < 0;

  const hasAnyActivity = requests.length > 0 || extLogs.length > 0;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Rate Lock</h1>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
            Current lock status, lock/extension requests, and extension history for this loan.
          </p>
        </div>
        <Link
          href="/rate-locks"
          className="shrink-0 inline-flex items-center rounded-lg px-3 py-2 text-[13px] font-semibold text-white"
          style={{ backgroundColor: 'var(--c-gold-deep)' }}
        >
          Open Extension Wizard
        </Link>
      </div>

      {/* Current lock summary */}
      {activeLock ? (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: expired
              ? 'rgba(239,68,68,0.4)'
              : expiringSoon
                ? 'rgba(234,179,8,0.45)'
                : 'var(--c-border)',
            backgroundColor: 'var(--c-surface)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-label3)]">
              Active Lock
            </span>
            <StatusPill status={activeLock.status} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            <Field label="Locked Rate" value={activeLock.requested_rate != null ? `${activeLock.requested_rate}%` : '—'} />
            <Field label="Lock Period" value={activeLock.requested_lock_days != null ? `${activeLock.requested_lock_days} days` : '—'} />
            <Field label="Price" value={activeLock.requested_price != null ? `${activeLock.requested_price}` : '—'} />
            <Field label="Expires" value={fmtDate(lockExpiry)} />
          </div>
          {(expiringSoon || expired) && (
            <div
              className="mt-3 rounded-lg px-3 py-2 text-[12px] font-medium"
              style={{
                backgroundColor: expired ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.12)',
                color: expired ? '#dc2626' : '#a16207',
              }}
            >
              {expired
                ? `This lock expired ${Math.abs(expiryDays as number)} day(s) ago. Renegotiate or re-lock.`
                : `Lock expires in ${expiryDays} day(s). Consider requesting an extension.`}
            </div>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl border p-6 text-center"
          style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-surface)' }}
        >
          <p className="text-[14px] font-semibold text-[var(--c-text)]">No active rate lock</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--c-label2)]">
            {hasAnyActivity
              ? 'There are lock requests on file but none are currently approved and active.'
              : 'This loan is floating. Submit a lock request to secure pricing for the borrower.'}
          </p>
          <Link
            href="/rate-locks"
            className="mt-3 inline-flex items-center rounded-lg border px-3 py-2 text-[13px] font-semibold text-[var(--c-text)]"
            style={{ borderColor: 'var(--c-border)' }}
          >
            Go to Rate Locks
          </Link>
        </div>
      )}

      {/* Requests history */}
      <section>
        <h2 className="text-[13px] font-semibold text-[var(--c-text)]">Lock Requests</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--c-label2)]">No lock requests recorded for this loan.</p>
        ) : (
          <div
            className="mt-2 overflow-hidden rounded-xl border"
            style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-surface)' }}
          >
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Rate</th>
                  <th className="px-3 py-2 font-semibold">Days</th>
                  <th className="px-3 py-2 font-semibold">Expiration</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Requested</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: 'var(--c-border)' }}>
                    <td className="px-3 py-2 font-medium text-[var(--c-text)]">
                      {TYPE_LABELS[r.request_type ?? ''] ?? r.request_type ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--c-label2)]">
                      {r.requested_rate != null ? `${r.requested_rate}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-[var(--c-label2)]">{r.requested_lock_days ?? '—'}</td>
                    <td className="px-3 py-2 text-[var(--c-label2)]">
                      {fmtDate(r.requested_lock_expiration ?? r.original_lock_expiration)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-[var(--c-label2)]">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Extension log */}
      <section>
        <h2 className="text-[13px] font-semibold text-[var(--c-text)]">Extension History</h2>
        {extLogs.length === 0 ? (
          <p className="mt-2 text-[13px] text-[var(--c-label2)]">
            No extension requests logged.{' '}
            <Link href="/rate-locks" className="font-semibold underline" style={{ color: 'var(--c-gold-deep)' }}>
              Start the extension wizard
            </Link>
            .
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {extLogs.map((l) => (
              <div
                key={l.id}
                className="rounded-xl border p-3"
                style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-surface)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--c-text)]">
                    +{l.extension_days_requested ?? '—'} day extension
                  </span>
                  <StatusPill status={l.outcome} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                  <Field label="From Expiry" value={fmtDate(l.lock_expiry_date)} />
                  <Field label="BPS / Day" value={l.bps_per_day != null ? `${l.bps_per_day}` : '—'} />
                  <Field
                    label="Est. Cost"
                    value={
                      l.total_cost_est != null
                        ? `$${Number(l.total_cost_est).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                        : '—'
                    }
                  />
                  <Field label="Logged" value={fmtDate(l.logged_at)} />
                </div>
                {l.outcome_notes && (
                  <p className="mt-2 text-[12px] text-[var(--c-label2)]">{l.outcome_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--c-label3)]">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-[var(--c-text)]">{value}</p>
    </div>
  );
}
